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
 * Corrección a lo que decía antes este archivo ("Salud no aplica IVA/SB/
 * campesino — EXCEL-AUDIT.md §2.4"): **no es cierto para el 0.5% Seguro
 * Campesino ni para un cargo fijo "OTROS CARGOS"**. La auditoría original
 * buscó referencias a las celdas compartidas `INFO GENERAL!E37/E38/E39`
 * (el mecanismo de Autos) y no encontró nada — pero `OFERTA AM` (la hoja
 * que se imprime junto a `CARATULA AM`, confirmado en la macro
 * `IMPRIMIR_OFERTA_AM`) tiene el 0.5% escrito directo en la fórmula
 * (`=SUBTOTAL*0.5%`), sin pasar por esas celdas — por eso esa búsqueda no
 * lo encontró. Verificado celda por celda, con la fórmula de cada columna
 * de plan referenciando directo la hoja de la aseguradora real (`=IF(...,
 * BMI!D9,...)`, `=IF(..., SALUDSA!E8,...)`, etc. — no una suposición de
 * columna): `OTROS CARGOS` es un cargo fijo que varía por aseguradora
 * ($0 a $80), y el 0.5% se cobra siempre sobre (prima neta + ese cargo).
 * BUPA queda afuera de esta tabla — es 100% manual (`EXCEL-AUDIT.md`
 * §2.3, sin tabla de tasas), así que lo que el ejecutivo digita a mano en
 * `setManualPremium` ya es el total final, sin ningún cargo que sumarle acá.
 */
const HEALTH_OTROS_CARGOS_CENTS: Record<string, number> = {
  BMI: 8000, // $80 — confirmado en OFERTA AM!H64 (planes SIGMA)
  SALUDSA: 2832, // $28.32 — OFERTA AM!CL64 (UNICO/ESENCIAL/PRACTICO/IDEAL/ELITE/PRIVILEGIO)
  SALUD: 2832, // $28.32 — OFERTA AM!BC64 (STAR/SKY/PRO_150.../PRO_500..., el "SALUD" genérico)
  CONFIAMED: 0, // OFERTA AM!DI64 — sin cargo fijo, pero el 0.5% sí aplica
  HUMANA: 0, // OFERTA AM!FD64 — sin cargo fijo, pero el 0.5% sí aplica
  PRO: 3600, // $36 — OFERTA AM!FS64 (hoja PRO, planes "Plan Life" 10K/15K)
  VB: 3600, // $36 — OFERTA AM!FU64 (hoja VB, "Plan Predilecto" 20K)
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
        const netPremiumCents = prices.reduce((sum, p) => sum + p, 0);

        // OTROS CARGOS + 0.5% Seguro Campesino — reales, ver el comentario
        // de HEALTH_OTROS_CARGOS_CENTS arriba. `emissionFeeCents` es el
        // campo que ya existe en el esquema para un cargo fijo por
        // emisión (mismo concepto que "Derechos de emisión" en Autos) —
        // se reusa en vez de agregar una columna nueva.
        const emissionFeeCents = HEALTH_OTROS_CARGOS_CENTS[insurer.code] ?? 0;
        const subtotalCents = netPremiumCents + emissionFeeCents;
        const campesinoCents = Math.round(subtotalCents * 0.005);
        const totalPremiumCents = subtotalCents + campesinoCents;

        await tx.insert(quoteOptions).values({
          organizationId,
          quoteRiskId,
          insurerId: insurer.id,
          modality: "ANUAL",
          planCode: plan.deductibleCode ? `${plan.planCode}_${plan.deductibleCode}` : plan.planCode,
          netPremiumCents,
          emissionFeeCents,
          campesinoCents,
          totalPremiumCents,
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
