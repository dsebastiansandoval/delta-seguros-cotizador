import { applyPercent } from "@/domains/shared/money";

/**
 * Impuestos ecuatorianos, literales del Excel — verificados en
 * EXCEL-AUDIT.md §2.4 (INFO GENERAL!E37/E38/E39): IVA 15%, Superintendencia
 * de Bancos 3.5%, Seguro Campesino 0.5%. No son configurables por
 * aseguradora ni por tenant — son ley, no negociación comercial.
 */
export const IVA_PERCENT = 15;
export const SUPER_BANCOS_PERCENT = 3.5;
export const SEGURO_CAMPESINO_PERCENT = 0.5;

export type PremiumBreakdown = {
  netPremiumCents: number;
  superBancosCents: number;
  campesinoCents: number;
  emissionFeeCents: number;
  ivaCents: number;
  totalPremiumCents: number;
};

/**
 * Reproduce exactamente `OFERTA!I42:I47` del Excel (EXCEL-AUDIT.md §2.4):
 * IVA se calcula sobre (neta + SB + campesino + derechos de emisión), no
 * solo sobre la neta — ese orden importa y ya causó una regresión sutil una
 * vez si se hace distinto, así que queda fijado acá y no se reimplementa
 * en ningún otro lugar del código (DRY — ARCHITECTURE.md §2).
 */
export function calculatePremium(
  netPremiumCents: number,
  emissionFeeCents: number,
): PremiumBreakdown {
  const superBancosCents = applyPercent(netPremiumCents, SUPER_BANCOS_PERCENT);
  const campesinoCents = applyPercent(netPremiumCents, SEGURO_CAMPESINO_PERCENT);
  const taxableBaseCents = netPremiumCents + superBancosCents + campesinoCents + emissionFeeCents;
  const ivaCents = applyPercent(taxableBaseCents, IVA_PERCENT);

  return {
    netPremiumCents,
    superBancosCents,
    campesinoCents,
    emissionFeeCents,
    ivaCents,
    totalPremiumCents: taxableBaseCents + ivaCents,
  };
}

/**
 * Tabla de derechos de emisión por tramo de valor asegurado — extraída de
 * INFO GENERAL!T6:V11 (EXCEL-AUDIT.md §2.4), valores reales, no de ejemplo.
 */
const EMISSION_FEE_BRACKETS: Array<{ min: number; max: number; feeCents: number }> = [
  { min: 0, max: 250, feeCents: 50 },
  { min: 251, max: 500, feeCents: 100 },
  { min: 501, max: 1000, feeCents: 300 },
  { min: 1001, max: 2000, feeCents: 500 },
  { min: 2001, max: 4000, feeCents: 700 },
  { min: 4001, max: Infinity, feeCents: 900 },
];

export function emissionFeeForNetPremium(netPremiumCents: number): number {
  const netPremiumDollars = netPremiumCents / 100;
  const bracket = EMISSION_FEE_BRACKETS.find(
    (b) => netPremiumDollars >= b.min && netPremiumDollars <= b.max,
  );
  return bracket?.feeCents ?? EMISSION_FEE_BRACKETS[EMISSION_FEE_BRACKETS.length - 1].feeCents;
}
