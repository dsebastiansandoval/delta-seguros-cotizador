import { formatUSD } from "@/domains/shared/money";
import { OFFER_COVERAGE_ROWS, type OfferCell } from "./insurer-offer-profiles";

const wholeUSD = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Celda de la hoja OFERTA: "$40.000 sin costo", "Sí otorga", "2 años"… */
export function formatOfferCell(cell: OfferCell | undefined): string {
  if (!cell) return "";
  return [cell.amount != null ? wholeUSD.format(cell.amount) : null, cell.text ?? null].filter(Boolean).join(" ");
}

export function formatRate(rate: string | null): string {
  return rate == null ? "" : `${(Number(rate) * 100).toFixed(2)}%`;
}

export function formatMoney(cents: number | null | undefined): string {
  return cents == null ? "" : formatUSD(cents);
}

export const PRINCIPAL_ROWS = OFFER_COVERAGE_ROWS.filter((r) => r.section === "PRINCIPALES");
export const ADDITIONAL_ROWS = OFFER_COVERAGE_ROWS.filter((r) => r.section === "ADICIONALES");

/** OFERTA filas 42-46, en el orden del Excel. */
export const PREMIUM_ROWS = [
  ["PRIMA NETA", "netPremiumCents"],
  ["3.50% SUPERINTENDENCIA DE BANCOS", "superBancosCents"],
  ["0.50% SEGURO CAMPESINO", "campesinoCents"],
  ["DERECHOS DE EMISIÓN", "emissionFeeCents"],
  ["15% IVA", "ivaCents"],
] as const;
