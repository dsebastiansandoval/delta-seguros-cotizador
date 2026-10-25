import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { insurers } from "@/db/schema/catalog";
import { quoteInsurerSettings, quoteOptions, quoteRisks } from "@/db/schema/quoting";
import { vehicles } from "@/db/schema/clients";
import { engineQuote } from "../offer/excel-rates";
import { breakdownForNet, premiumFromTotal, type PremiumBreakdown } from "./premium.calculator";
import { KM_BRACKETS } from "../constants";

const EMPTY_PREMIUM = {
  netPremiumCents: null,
  superBancosCents: null,
  campesinoCents: null,
  emissionFeeCents: null,
  ivaCents: null,
  totalPremiumCents: null,
  ratePercentApplied: null,
};

function premiumColumns(breakdown: PremiumBreakdown, rate: number) {
  return {
    netPremiumCents: breakdown.netPremiumCents,
    superBancosCents: breakdown.superBancosCents,
    campesinoCents: breakdown.campesinoCents,
    emissionFeeCents: breakdown.emissionFeeCents,
    ivaCents: breakdown.ivaCents,
    totalPremiumCents: breakdown.totalPremiumCents,
    ratePercentApplied: rate.toFixed(5),
  };
}

/**
 * Filas de la comparativa: una por aseguradora × riesgo (DATOS OFERTA
 * columnas C..O, filas 31/35/39/43 del Excel). Latina y Cóndor se calculan
 * con su motor; el resto queda vacío hasta que el ejecutivo digite la prima.
 */
export const comparisonService = {
  async createOptionsForRisk(tx: Db, organizationId: string, quoteRiskId: string) {
    const activeInsurers = await tx
      .select({ id: insurers.id })
      .from(insurers)
      .where(and(eq(insurers.branch, "AUTOS"), eq(insurers.isActive, true)));

    if (activeInsurers.length) {
      await tx.insert(quoteOptions).values(
        activeInsurers.map((insurer) => ({
          organizationId,
          quoteRiskId,
          insurerId: insurer.id,
          modality: "ANUAL" as const,
          source: "MANUAL" as const,
        })),
      );
    }
  },

  /**
   * Auto x Km — una fila por rango (DATOS OFERTA X KM E7:J7) para cada
   * aseguradora que vende la modalidad (`insurers.supportsKm`, hoy solo AIG).
   */
  async runKmComparisonForRisk(tx: Db, organizationId: string, quoteRiskId: string) {
    const kmInsurers = await tx
      .select({ id: insurers.id })
      .from(insurers)
      .where(
        and(eq(insurers.branch, "AUTOS"), eq(insurers.isActive, true), eq(insurers.supportsKm, true)),
      );

    const rows = kmInsurers.flatMap((insurer) =>
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

  async hasOptions(tx: Db, quoteRiskId: string): Promise<boolean> {
    const [row] = await tx
      .select({ id: quoteOptions.id })
      .from(quoteOptions)
      .where(eq(quoteOptions.quoteRiskId, quoteRiskId))
      .limit(1);
    return Boolean(row);
  },

  /**
   * Recalcula Latina y Cóndor en todos los riesgos — se llama al crear la
   * cotización y cada vez que cambia la configuración, porque "Solo pérdida
   * total" cambia la tasa de Latina (DATOS OFERTA!L33).
   */
  async repriceEngines(tx: Db, quoteId: string, currentYear = new Date().getFullYear()) {
    const rows = await tx
      .select({
        quoteOptionId: quoteOptions.id,
        insurerId: insurers.id,
        insurerCode: insurers.code,
        bodyType: vehicles.bodyType,
        vehicleYear: vehicles.year,
        insuredValueCents: quoteRisks.insuredValueCents,
        extrasValueCents: quoteRisks.extrasValueCents,
      })
      .from(quoteOptions)
      .innerJoin(insurers, eq(insurers.id, quoteOptions.insurerId))
      .innerJoin(quoteRisks, eq(quoteRisks.id, quoteOptions.quoteRiskId))
      .innerJoin(vehicles, eq(vehicles.id, quoteRisks.vehicleId))
      .where(
        and(
          eq(quoteRisks.quoteId, quoteId),
          eq(quoteOptions.modality, "ANUAL"),
          inArray(insurers.code, ["LATINA", "CONDOR"]),
        ),
      );
    if (!rows.length) return;

    const settings = await tx
      .select({ insurerId: quoteInsurerSettings.insurerId, coverageType: quoteInsurerSettings.coverageType })
      .from(quoteInsurerSettings)
      .where(eq(quoteInsurerSettings.quoteId, quoteId));
    const coverageTypeByInsurer = new Map(settings.map((s) => [s.insurerId, s.coverageType]));

    for (const row of rows) {
      const quote = engineQuote(
        row.insurerCode,
        {
          bodyType: row.bodyType,
          vehicleYear: row.vehicleYear,
          insuredValueCents: row.insuredValueCents ?? 0,
          extrasValueCents: row.extrasValueCents ?? 0,
        },
        coverageTypeByInsurer.get(row.insurerId) ?? "TODO_RIESGO",
        currentYear,
      );
      const values =
        quote && quote !== "MANUAL"
          ? premiumColumns(breakdownForNet(quote.netPremiumCents), quote.rate)
          : EMPTY_PREMIUM;
      await tx.update(quoteOptions).set(values).where(eq(quoteOptions.id, row.quoteOptionId));
    }
  },

  /**
   * Prima digitada del portal de la aseguradora. Anual: prima neta (DATOS
   * OFERTA fila PN). Auto x Km: prima total (DATOS OFERTA X KM fila PT), la
   * neta se despeja. La tasa es neta / (casco + extras), como en el Excel.
   * `null` borra la prima.
   */
  async setManualPremium(tx: Db, quoteOptionId: string, premiumCents: number | null) {
    if (premiumCents == null) {
      await tx.update(quoteOptions).set(EMPTY_PREMIUM).where(eq(quoteOptions.id, quoteOptionId));
      return;
    }

    const [option] = await tx
      .select({
        modality: quoteOptions.modality,
        insuredValueCents: quoteRisks.insuredValueCents,
        extrasValueCents: quoteRisks.extrasValueCents,
      })
      .from(quoteOptions)
      .innerJoin(quoteRisks, eq(quoteRisks.id, quoteOptions.quoteRiskId))
      .where(eq(quoteOptions.id, quoteOptionId))
      .limit(1);
    if (!option) throw new Error("Opción de cotización no encontrada");

    const breakdown =
      option.modality === "POR_KM" ? premiumFromTotal(premiumCents) : breakdownForNet(premiumCents);
    const valueCents = (option.insuredValueCents ?? 0) + (option.extrasValueCents ?? 0);
    const rate = valueCents > 0 ? breakdown.netPremiumCents / valueCents : 0;

    await tx.update(quoteOptions).set(premiumColumns(breakdown, rate)).where(eq(quoteOptions.id, quoteOptionId));
  },
};
