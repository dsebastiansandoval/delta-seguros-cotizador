import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { insurers } from "@/db/schema/catalog";
import { quoteOptions, quoteRisks } from "@/db/schema/quoting";
import { vehicles } from "@/db/schema/clients";
import { RateTableAdapter } from "../gateways/rate-table.adapter";
import { calculatePremium, emissionFeeForNetPremium } from "./premium.calculator";
import { KM_BRACKETS } from "../constants";

export type ComparisonRow = {
  quoteOptionId: string;
  insurerId: string;
  insurerCode: string;
  insurerName: string;
  modality: "ANUAL" | "POR_KM";
  kmBracket: number | null;
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

  /**
   * Auto x Km — 100% manual, confirmado en EXCEL-AUDIT.md §11.4b: no hay
   * tabla de tasas para esta modalidad en ninguna aseguradora, ni siquiera
   * Latina/Cóndor. Se crea una fila PENDIENTE_MANUAL por aseguradora × rango
   * de km — 6 rangos, igual que `DATOS OFERTA X KM` en el Excel.
   */
  async runKmComparisonForRisk(tx: Db, organizationId: string, quoteRiskId: string) {
    const activeInsurers = await tx
      .select()
      .from(insurers)
      .where(and(eq(insurers.branch, "AUTOS"), eq(insurers.isActive, true)));

    const rows = activeInsurers.flatMap((insurer) =>
      KM_BRACKETS.map((kmBracket) => ({
        organizationId,
        quoteRiskId,
        insurerId: insurer.id,
        modality: "POR_KM" as const,
        kmBracket,
        source: "MANUAL" as const,
      })),
    );

    if (rows.length) await tx.insert(quoteOptions).values(rows);
  },

  async getComparisonForRisk(tx: Db, quoteRiskId: string): Promise<ComparisonRow[]> {
    const rows = await tx
      .select({
        quoteOptionId: quoteOptions.id,
        insurerId: insurers.id,
        insurerCode: insurers.code,
        insurerName: insurers.name,
        modality: quoteOptions.modality,
        kmBracket: quoteOptions.kmBracket,
        netPremiumCents: quoteOptions.netPremiumCents,
        totalPremiumCents: quoteOptions.totalPremiumCents,
        ratePercentApplied: quoteOptions.ratePercentApplied,
      })
      .from(quoteOptions)
      .innerJoin(insurers, eq(insurers.id, quoteOptions.insurerId))
      .where(eq(quoteOptions.quoteRiskId, quoteRiskId));

    const withStatus = rows.map((r) => ({
      ...r,
      status: (r.totalPremiumCents == null ? "PENDIENTE_MANUAL" : "COTIZADO") as
        | "COTIZADO"
        | "PENDIENTE_MANUAL",
    }));

    // ANUAL: una fila por aseguradora — ordena por precio, la más barata primero.
    // POR_KM: varias filas por aseguradora (una por rango) — ordena por
    // aseguradora y luego por rango, para que la UI las agrupe en una grilla.
    if (withStatus[0]?.modality === "POR_KM") {
      return withStatus.sort(
        (a, b) =>
          a.insurerName.localeCompare(b.insurerName) || (a.kmBracket ?? 0) - (b.kmBracket ?? 0),
      );
    }
    return withStatus.sort(
      (a, b) => (a.totalPremiumCents ?? Infinity) - (b.totalPremiumCents ?? Infinity),
    );
  },

  /**
   * El ejecutivo digita la prima neta que le cotizó la aseguradora por
   * teléfono/portal propio — el mismo paso manual que hoy hace en el Excel,
   * solo que centralizado. Recalcula impuestos y derechos de emisión con la
   * misma fórmula que las aseguradoras con tabla real (premium.calculator) —
   * nunca dos lugares distintos calculando el mismo impuesto.
   */
  async setManualPremium(tx: Db, quoteOptionId: string, netPremiumCents: number) {
    const emissionFeeCents = emissionFeeForNetPremium(netPremiumCents);
    const breakdown = calculatePremium(netPremiumCents, emissionFeeCents);

    await tx
      .update(quoteOptions)
      .set({
        netPremiumCents: breakdown.netPremiumCents,
        superBancosCents: breakdown.superBancosCents,
        campesinoCents: breakdown.campesinoCents,
        emissionFeeCents: breakdown.emissionFeeCents,
        ivaCents: breakdown.ivaCents,
        totalPremiumCents: breakdown.totalPremiumCents,
      })
      .where(eq(quoteOptions.id, quoteOptionId));
  },
};
