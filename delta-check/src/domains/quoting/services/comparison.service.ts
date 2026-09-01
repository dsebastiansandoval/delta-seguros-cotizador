import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { insurers } from "@/db/schema/catalog";
import { quoteOptions, quoteRisks } from "@/db/schema/quoting";
import { vehicles } from "@/db/schema/clients";
import { RateTableAdapter } from "../gateways/rate-table.adapter";
import { calculatePremium, emissionFeeForNetPremium } from "./premium.calculator";

export type ComparisonRow = {
  insurerId: string;
  insurerCode: string;
  insurerName: string;
  status: "COTIZADO" | "PENDIENTE_MANUAL";
  netPremiumCents: number | null;
  totalPremiumCents: number | null;
  ratePercentApplied: string | null;
};

/**
 * Cotiza contra todas las aseguradoras activas de Autos y persiste el
 * resultado — reemplaza copiar y pegar entre 13 hojas del Excel
 * (EXCEL-AUDIT.md). Las aseguradoras sin tabla real quedan en
 * PENDIENTE_MANUAL, el mismo estado en que ya están hoy — no se fabrica una
 * cifra que nadie escribió.
 */
export const comparisonService = {
  async runComparisonForRisk(tx: Db, organizationId: string, quoteRiskId: string) {
    const [risk] = await tx
      .select()
      .from(quoteRisks)
      .where(eq(quoteRisks.id, quoteRiskId))
      .limit(1);
    if (!risk || !risk.vehicleId) throw new Error("Riesgo sin vehículo asociado");

    const [vehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, risk.vehicleId));
    if (!vehicle) throw new Error("Vehículo no encontrado");

    const activeInsurers = await tx
      .select()
      .from(insurers)
      .where(and(eq(insurers.branch, "AUTOS"), eq(insurers.isActive, true)));

    const gateway = new RateTableAdapter(tx);
    const insuredValueCents = risk.insuredValueCents ?? 0;

    for (const insurer of activeInsurers) {
      const result = await gateway.quote({
        insurerId: insurer.id,
        bodyType: vehicle.bodyType,
        vehicleYear: vehicle.year,
        insuredValueCents,
      });

      if (result.status === "NO_COTIZA") continue; // no se crea fila — no aplica para este riesgo

      if (result.status === "PENDIENTE_MANUAL") {
        await tx.insert(quoteOptions).values({
          organizationId,
          quoteRiskId,
          insurerId: insurer.id,
          modality: "ANUAL",
          source: "MANUAL", // pendiente de que el ejecutivo digite la prima neta
        });
        continue;
      }

      const emissionFeeCents = emissionFeeForNetPremium(result.netPremiumCents);
      const breakdown = calculatePremium(result.netPremiumCents, emissionFeeCents);

      await tx.insert(quoteOptions).values({
        organizationId,
        quoteRiskId,
        insurerId: insurer.id,
        modality: "ANUAL",
        netPremiumCents: breakdown.netPremiumCents,
        superBancosCents: breakdown.superBancosCents,
        campesinoCents: breakdown.campesinoCents,
        emissionFeeCents: breakdown.emissionFeeCents,
        ivaCents: breakdown.ivaCents,
        totalPremiumCents: breakdown.totalPremiumCents,
        ratePercentApplied: result.ratePercentApplied,
        // "MANUAL" acá significa "no vino de una API externa real" —
        // sigue siendo así hasta Fase 4, aunque el número lo calculó el
        // motor de tasas y no un ejecutivo. Ver domains/quoting/gateways/insurer.gateway.ts.
        source: "MANUAL",
      });
    }
  },

  async getComparisonForRisk(tx: Db, quoteRiskId: string): Promise<ComparisonRow[]> {
    const rows = await tx
      .select({
        insurerId: insurers.id,
        insurerCode: insurers.code,
        insurerName: insurers.name,
        netPremiumCents: quoteOptions.netPremiumCents,
        totalPremiumCents: quoteOptions.totalPremiumCents,
        ratePercentApplied: quoteOptions.ratePercentApplied,
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
};
