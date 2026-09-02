import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { insurers } from "@/db/schema/catalog";
import { quoteOptions, quoteRisks } from "@/db/schema/quoting";
import { insuredGroups, insuredMembers } from "@/db/schema/clients";
import { HealthRateTableAdapter } from "../gateways/health-rate-table.adapter";
import type { HealthPlanQuote } from "../gateways/health-insurer.gateway";

export type HealthComparisonRow = {
  quoteOptionId: string;
  insurerId: string;
  insurerCode: string;
  insurerName: string;
  planCode: string | null;
  status: "COTIZADO" | "PENDIENTE_MANUAL";
  totalPremiumCents: number | null;
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
      // planKey (planCode|deductibleCode) -> lista de primas, una por miembro que sí tuvo precio
      const plansByKey = new Map<string, { plan: HealthPlanQuote; prices: number[] }>();
      let anyoneUnpriced = false;

      for (const member of members) {
        const result = await gateway.quoteMember({
          insurerId: insurer.id,
          age: member.age,
          gender: member.gender,
          region: group.region,
        });

        if (result.status === "PENDIENTE_MANUAL") {
          anyoneUnpriced = true;
          break;
        }

        for (const plan of result.plans) {
          const key = `${plan.planCode}|${plan.deductibleCode ?? ""}`;
          const entry = plansByKey.get(key) ?? { plan, prices: [] };
          entry.prices.push(plan.premiumCents);
          plansByKey.set(key, entry);
        }
      }

      if (anyoneUnpriced || plansByKey.size === 0) {
        await tx.insert(quoteOptions).values({
          organizationId,
          quoteRiskId,
          insurerId: insurer.id,
          modality: "ANUAL",
          source: "MANUAL",
        });
        continue;
      }

      for (const { plan, prices } of plansByKey.values()) {
        // Un plan solo se ofrece completo si TODOS los miembros tienen precio en él.
        if (prices.length !== members.length) continue;
        const totalCents = prices.reduce((sum, p) => sum + p, 0);

        await tx.insert(quoteOptions).values({
          organizationId,
          quoteRiskId,
          insurerId: insurer.id,
          modality: "ANUAL",
          planCode: plan.deductibleCode ? `${plan.planCode}_${plan.deductibleCode}` : plan.planCode,
          netPremiumCents: totalCents,
          totalPremiumCents: totalCents, // Salud no aplica IVA/SB/campesino — EXCEL-AUDIT.md §2.4
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
        totalPremiumCents: quoteOptions.totalPremiumCents,
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

  async setManualPremium(tx: Db, quoteOptionId: string, totalPremiumCents: number) {
    await tx
      .update(quoteOptions)
      .set({ netPremiumCents: totalPremiumCents, totalPremiumCents })
      .where(eq(quoteOptions.id, quoteOptionId));
  },
};
