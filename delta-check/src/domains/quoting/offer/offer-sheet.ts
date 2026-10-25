import { calculatePremium, emissionFeeForNetPremium, type PremiumBreakdown } from "../services/premium.calculator";
import type { CoverageType } from "./excel-rates";
import type { OfferCell, OfferCoverageKey } from "./insurer-offer-profiles";

export type InsurerSettingsValues = {
  included: boolean;
  coverageType: CoverageType;
  amparoPatrimonial: boolean;
  rcAmountCents: number | null;
  gmAmountCents: number | null;
  partialDeductible: string | null;
  totalLossDeductible: string | null;
};

export type RiskPremium = {
  quoteOptionId: string;
  riskNumber: number;
  netPremiumCents: number | null;
  ratePercentApplied: string | null;
};

export type OfferColumn = {
  insurerId: string;
  insurerName: string;
  cells: Record<OfferCoverageKey, OfferCell>;
  partialDeductible: string;
  totalLossDeductible: string;
  risks: RiskPremium[];
  totals: PremiumBreakdown | null;
};

const SOLO_PT = "Solo pérdida total";

/**
 * Una columna de la hoja OFERTA: coberturas del perfil congelado con los
 * ajustes de DATOS OFERTA encima (filas 11/13/30/33 dependen de "tipo" y
 * "amparo"; 17/19 del RC/GM elegido) y los totales sumando todos los riesgos.
 */
export function buildOfferColumn(params: {
  insurerId: string;
  insurerName: string;
  snapshot: Record<OfferCoverageKey, OfferCell>;
  settings: InsurerSettingsValues;
  risks: RiskPremium[];
}): OfferColumn {
  const { snapshot, settings } = params;
  const soloPt = settings.coverageType === "SOLO_PERDIDA_TOTAL";

  const cells = { ...snapshot };
  cells.PERDIDA_PARCIAL = { text: soloPt ? SOLO_PT : "Sí otorga" };
  cells.ROBO_PARCIAL = { text: soloPt ? SOLO_PT : "Sí otorga" };
  if (settings.rcAmountCents != null) cells.RC = { ...cells.RC, amount: settings.rcAmountCents / 100 };
  if (settings.gmAmountCents != null) cells.GM = { ...cells.GM, amount: settings.gmAmountCents / 100 };
  cells.AMPARO_PATRIMONIAL = { text: settings.amparoPatrimonial ? "Sí otorga" : "No otorga" };

  return {
    insurerId: params.insurerId,
    insurerName: params.insurerName,
    cells,
    partialDeductible: soloPt ? SOLO_PT : (settings.partialDeductible ?? ""),
    totalLossDeductible: settings.totalLossDeductible ?? "",
    risks: params.risks,
    totals: combineRiskPremiums(params.risks),
  };
}

/**
 * OFERTA filas 42-47: la prima neta es la suma de los riesgos y los impuestos
 * se calculan sobre esa suma. Los derechos de emisión salen de la prima neta
 * del riesgo 1 (el Excel hace VLOOKUP sobre DATOS OFERTA fila 31); si el
 * riesgo 1 no tiene prima, se usa el primer riesgo cotizado.
 */
export function combineRiskPremiums(risks: RiskPremium[]): PremiumBreakdown | null {
  const priced = risks
    .filter((r): r is RiskPremium & { netPremiumCents: number } => r.netPremiumCents != null)
    .sort((a, b) => a.riskNumber - b.riskNumber);
  if (!priced.length) return null;

  const netPremiumCents = priced.reduce((sum, r) => sum + r.netPremiumCents, 0);
  return calculatePremium(netPremiumCents, emissionFeeForNetPremium(priced[0].netPremiumCents));
}

/** OFERTA filas 51-54: contado y tarjeta a 6/9/12 meses sin interés. */
export const INSTALLMENT_TERMS = [6, 9, 12] as const;

export function installmentCents(totalCents: number, months: number): number {
  return Math.round(totalCents / months);
}
