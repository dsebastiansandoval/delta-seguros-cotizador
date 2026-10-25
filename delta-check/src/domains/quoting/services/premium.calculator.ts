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
 * Tabla de derechos de emisión — INFO GENERAL!T6:V11 (EXCEL-AUDIT.md §2.4).
 * El Excel la consulta con VLOOKUP aproximado sobre la columna DESDE, así
 * que una neta con centavos entre tramos (ej. 250.50) cae en el tramo
 * anterior; por eso solo importa el umbral inferior (y el último es 4000,
 * no 4001, tal cual está en la hoja).
 */
const EMISSION_FEE_BRACKETS: Array<{ fromCents: number; feeCents: number }> = [
  { fromCents: 0, feeCents: 50 },
  { fromCents: 25100, feeCents: 100 },
  { fromCents: 50100, feeCents: 300 },
  { fromCents: 100100, feeCents: 500 },
  { fromCents: 200100, feeCents: 700 },
  { fromCents: 400000, feeCents: 900 },
];

export function emissionFeeForNetPremium(netPremiumCents: number): number {
  let feeCents = EMISSION_FEE_BRACKETS[0].feeCents;
  for (const bracket of EMISSION_FEE_BRACKETS) {
    if (netPremiumCents >= bracket.fromCents) feeCents = bracket.feeCents;
  }
  return feeCents;
}

export function breakdownForNet(netPremiumCents: number): PremiumBreakdown {
  return calculatePremium(netPremiumCents, emissionFeeForNetPremium(netPremiumCents));
}

/**
 * Auto x Km: el ejecutivo digita la prima TOTAL que le da el portal de la
 * aseguradora (`DATOS OFERTA X KM!E10:J10`) y la neta se despeja hacia
 * atrás (`OFERTA KM!H37`). El Excel asume siempre derechos de $0.50; acá se
 * busca la neta cuyo desglose completo (con el derecho de su propio tramo)
 * suma exactamente el total digitado, o el más cercano si el redondeo a
 * centavos no permite exactitud.
 */
export function premiumFromTotal(totalPremiumCents: number): PremiumBreakdown {
  const grossUpFactor =
    (1 + (SUPER_BANCOS_PERCENT + SEGURO_CAMPESINO_PERCENT) / 100) * (1 + IVA_PERCENT / 100);

  let best: PremiumBreakdown | null = null;
  for (const { feeCents } of EMISSION_FEE_BRACKETS) {
    const approxNet = Math.round(
      (totalPremiumCents - feeCents * (1 + IVA_PERCENT / 100)) / grossUpFactor,
    );
    for (let delta = -3; delta <= 3; delta++) {
      const net = approxNet + delta;
      if (net <= 0) continue;
      const candidate = breakdownForNet(net);
      if (
        !best ||
        Math.abs(candidate.totalPremiumCents - totalPremiumCents) <
          Math.abs(best.totalPremiumCents - totalPremiumCents)
      ) {
        best = candidate;
      }
    }
  }
  if (!best) throw new Error("La prima total es demasiado baja para cubrir impuestos y derechos de emisión");
  return best;
}
