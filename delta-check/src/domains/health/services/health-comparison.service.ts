import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { insurers } from "@/db/schema/catalog";
import { quoteOptions, quoteRisks } from "@/db/schema/quoting";
import { insuredGroups, insuredMembers } from "@/db/schema/clients";
import { HealthRateTableAdapter } from "../gateways/health-rate-table.adapter";
import type { HealthPlanQuote } from "../gateways/health-insurer.gateway";
import { healthPremium, otrosCargosCents } from "./health-premium";
import { HEALTH_PLANS } from "../health-plans.generated";

export type HealthComparisonRow = {
  quoteOptionId: string;
  insurerId: string;
  insurerCode: string;
  insurerName: string;
  planCode: string | null;
  status: "COTIZADO" | "PENDIENTE_MANUAL";
  netPremiumCents: number | null;
  totalPremiumCents: number | null;
  includedInOffer: boolean;
};

/**
 * Cotiza cada miembro del grupo (titular + dependientes) contra cada
 * aseguradora activa de Salud, y suma por plan — un plan solo cuenta como
 * "cotizado" si CADA miembro tiene precio para ese mismo plan+deducible; si
 * a alguien le falta, ese plan no se ofrece completo y se descarta en vez
 * de mostrar una familia a medias. Si la aseguradora no tiene tabla en
 * absoluto (o algún miembro no cae en ningún tramo), la aseguradora entera
 * queda PENDIENTE_MANUAL — mismo criterio de honestidad que Autos.
 */
export const healthComparisonService = {
  async runComparisonForRisk(tx: Db, organizationId: string, quoteRiskId: string) {
    const [risk] = await tx.select().from(quoteRisks).where(eq(quoteRisks.id, quoteRiskId)).limit(1);
    if (!risk || !risk.insuredGroupId) throw new Error("Riesgo sin grupo asegurado");

    const [group] = await tx.select().from(insuredGroups).where(eq(insuredGroups.id, risk.insuredGroupId));
    if (!group) throw new Error("Grupo asegurado no encontrado");

    const members = await tx.select().from(insuredMembers).where(eq(insuredMembers.groupId, group.id));
    if (!members.length) throw new Error("El grupo no tiene miembros");

    const activeInsurers = await tx
      .select()
      .from(insurers)
      .where(and(eq(insurers.branch, "SALUD"), eq(insurers.isActive, true)));

    const gateway = new HealthRateTableAdapter(tx);

    for (const insurer of activeInsurers) {
      // planKey (planCode|deductibleCode) -> prima de cada miembro que sí tuvo precio
      const plansByKey = new Map<string, { plan: HealthPlanQuote; prices: Map<string, number> }>();
      let anyoneUnpriced = false;

      for (const member of members) {
        const result = await gateway.quoteMember({
          insurerId: insurer.id,
          age: member.age,
          gender: member.gender,
          region: group.region,
          relation: member.relation,
        });

        if (result.status === "PENDIENTE_MANUAL") {
          anyoneUnpriced = true;
          break;
        }

        for (const plan of result.plans) {
          const key = `${plan.planCode}|${plan.deductibleCode ?? ""}`;
          const entry = plansByKey.get(key) ?? { plan, prices: new Map<string, number>() };
          entry.prices.set(member.id, plan.premiumCents);
          plansByKey.set(key, entry);
        }
      }

      if (anyoneUnpriced || plansByKey.size === 0) {
        // Sin tabla (BUPA): una opción por plan del Excel para digitar su prima; si no hay
        // catálogo de planes, una sola opción por aseguradora.
        const manualPlans = HEALTH_PLANS.filter((p) => p.insurerCode === insurer.code && p.manual);
        await tx.insert(quoteOptions).values(
          (manualPlans.length ? manualPlans.map((p) => p.planCode) : [null]).map((planCode) => ({
            organizationId,
            quoteRiskId,
            insurerId: insurer.id,
            modality: "ANUAL" as const,
            planCode,
            source: "MANUAL" as const,
          })),
        );
        continue;
      }

      for (const { plan, prices } of plansByKey.values()) {
        // Un plan solo se ofrece completo si TODOS los miembros tienen precio en él.
        if (prices.size !== members.length) continue;
        const netPremiumCents = [...prices.values()].reduce((sum, p) => sum + p, 0);
        const planCode = plan.deductibleCode ? `${plan.planCode}_${plan.deductibleCode}` : plan.planCode;

        // `emissionFeeCents` guarda OTROS CARGOS (mismo concepto que derechos de emisión en Autos).
        await tx.insert(quoteOptions).values({
          organizationId,
          quoteRiskId,
          insurerId: insurer.id,
          modality: "ANUAL",
          planCode,
          ...healthPremium(netPremiumCents, otrosCargosCents(insurer.code, planCode)),
          memberPremiums: Object.fromEntries(prices),
          source: "MANUAL",
        });
      }
    }
  },

  async getComparisonForRisk(tx: Db, quoteRiskId: string): Promise<HealthComparisonRow[]> {
    const rows = await tx
      .select({
        quoteOptionId: quoteOptions.id,
        insurerId: insurers.id,
        insurerCode: insurers.code,
        insurerName: insurers.name,
        planCode: quoteOptions.planCode,
        netPremiumCents: quoteOptions.netPremiumCents,
        totalPremiumCents: quoteOptions.totalPremiumCents,
        includedInOffer: quoteOptions.includedInOffer,
      })
      .from(quoteOptions)
      .innerJoin(insurers, eq(insurers.id, quoteOptions.insurerId))
      .where(eq(quoteOptions.quoteRiskId, quoteRiskId));

    return rows
      .map((r) => ({
        ...r,
        status: (r.totalPremiumCents == null ? "PENDIENTE_MANUAL" : "COTIZADO") as
          | "COTIZADO"
          | "PENDIENTE_MANUAL",
      }))
      .sort((a, b) => (a.totalPremiumCents ?? Infinity) - (b.totalPremiumCents ?? Infinity));
  },

  /**
   * Guarda la configuración de OFERTA AM: qué planes se muestran y la prima
   * neta del grupo digitada a mano para planes sin tabla (BUPA), a la que se
   * suman sus cargos igual que en el Excel. Solo acepta opciones de este riesgo.
   */
  async saveConfiguration(
    tx: Db,
    quoteRiskId: string,
    input: { includedIds: string[]; premiums: Array<{ quoteOptionId: string; netPremiumCents: number | null }> },
  ) {
    const rows = await this.getComparisonForRisk(tx, quoteRiskId);
    const byId = new Map(rows.map((r) => [r.quoteOptionId, r]));
    for (const id of [...input.includedIds, ...input.premiums.map((p) => p.quoteOptionId)]) {
      if (!byId.has(id)) throw new Error("Opción que no pertenece a esta cotización");
    }

    for (const { quoteOptionId, netPremiumCents } of input.premiums) {
      const row = byId.get(quoteOptionId)!;
      if (row.netPremiumCents === netPremiumCents) continue;
      await tx
        .update(quoteOptions)
        .set(
          netPremiumCents == null
            ? { netPremiumCents: null, emissionFeeCents: null, campesinoCents: null, totalPremiumCents: null }
            : healthPremium(netPremiumCents, otrosCargosCents(row.insurerCode, row.planCode)),
        )
        .where(eq(quoteOptions.id, quoteOptionId));
    }

    await tx.update(quoteOptions).set({ includedInOffer: false }).where(eq(quoteOptions.quoteRiskId, quoteRiskId));
    if (input.includedIds.length) {
      await tx
        .update(quoteOptions)
        .set({ includedInOffer: true })
        .where(and(eq(quoteOptions.quoteRiskId, quoteRiskId), inArray(quoteOptions.id, input.includedIds)));
    }
  },
};
