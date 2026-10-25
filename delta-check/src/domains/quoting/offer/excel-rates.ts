/**
 * Motor de tasas de Latina y Cóndor — reproduce las fórmulas de DATOS OFERTA
 * (L31/L33 y O31/O33) y las tablas de INFO GENERAL (AF:AJ y AL:AV) de
 * COTIZADOR ACTUALIZADO.xlsm. Las otras 11 aseguradoras se digitan a mano.
 */
export type CoverageType = "TODO_RIESGO" | "SOLO_PERDIDA_TOTAL";

export type RateRisk = {
  bodyType: string;
  vehicleYear: number;
  insuredValueCents: number;
  extrasValueCents: number;
};

export type EngineQuote = { netPremiumCents: number; rate: number } | null;

type Bracket = { from: number; rate: number };

// INFO GENERAL!AF7:AH11 y AF14:AH17 — VLOOKUP aproximado sobre DESDE.
const LATINA_TODO_RIESGO: Record<string, Bracket[]> = {
  LIVIANO: [
    { from: 10000, rate: 0.051 },
    { from: 15000, rate: 0.042 },
    { from: 20000, rate: 0.032 },
    { from: 25000, rate: 0.025 },
    { from: 35000, rate: 0.023 },
  ],
  PICKUP: [
    { from: 10000, rate: 0.051 },
    { from: 15000, rate: 0.046 },
    { from: 30000, rate: 0.032 },
    { from: 50001, rate: 0.023 },
  ],
};
// INFO GENERAL!AJ7
const LATINA_SOLO_PT_RATE = 0.03;

export function latinaQuote(risk: RateRisk, coverageType: CoverageType, currentYear: number): EngineQuote {
  const age = currentYear - risk.vehicleYear;
  const valueCents = risk.insuredValueCents + risk.extrasValueCents;

  let rate: number | null = null;
  if (coverageType === "SOLO_PERDIDA_TOTAL") {
    if (age <= 13) rate = LATINA_SOLO_PT_RATE;
  } else if (age <= 10) {
    const table = LATINA_TODO_RIESGO[risk.bodyType];
    if (table) {
      for (const bracket of table) {
        if (valueCents >= bracket.from * 100) rate = bracket.rate;
      }
    }
  }
  if (rate == null) return null;
  return { rate, netPremiumCents: Math.round(valueCents * rate) };
}

type CondorRow = { from: number; to: number; years: number; rate: number };

function condorBand(from: number, to: number, firstYear: number, rates: number[]): CondorRow[] {
  return rates.map((rate, i) => ({ from, to, years: firstYear + i, rate }));
}

// INFO GENERAL!AL7:AO38 (LIVIANO) y AR7:AU44 (PICKUP), en el mismo orden de la hoja.
const CONDOR_TABLE: Record<string, CondorRow[]> = {
  LIVIANO: [
    ...condorBand(0.01, 19999, 0, [0.03, 0.03, 0.03, 0.03, 0.034, 0.034, 0.038, 0.04, 0.042, 0.044, 0.047]),
    ...condorBand(20000, 24999, 1, [0.03, 0.03, 0.03, 0.03, 0.03, 0.033, 0.035, 0.037, 0.039, 0.041]),
    ...condorBand(25000, 79999, 0, [0.025, 0.025, 0.025, 0.025, 0.025, 0.025, 0.027, 0.027, 0.027, 0.031, 0.031]),
  ],
  PICKUP: [
    ...condorBand(0.01, 19999, 0, Array(11).fill(0.0356)),
    ...condorBand(20000, 24999, 1, Array(10).fill(0.0356)),
    ...condorBand(0.01, 44999, 0, Array(6).fill(0.0356)),
    ...condorBand(45000, 79999, 0, Array(6).fill(0.0356)),
    ...condorBand(25000, 79999, 6, Array(5).fill(0.0356)),
  ],
};
// DATOS OFERTA!O31: prima neta mínima de Cóndor.
export const CONDOR_MIN_PREMIUM_CENTS = 40000;

export function condorQuote(risk: RateRisk, currentYear: number): EngineQuote {
  const casco = risk.insuredValueCents / 100;
  const years = Math.max(1, currentYear - risk.vehicleYear + 1);
  const row = (CONDOR_TABLE[risk.bodyType] ?? []).find(
    (r) => casco >= r.from && casco <= r.to && years === r.years,
  );
  if (!row) return null;
  const premium = Math.round((risk.insuredValueCents + risk.extrasValueCents) * row.rate);
  return { rate: row.rate, netPremiumCents: Math.max(premium, CONDOR_MIN_PREMIUM_CENTS) };
}

/** Aseguradoras con motor propio; el resto queda en digitación manual. */
export function engineQuote(
  insurerCode: string,
  risk: RateRisk,
  coverageType: CoverageType,
  currentYear: number,
): EngineQuote | "MANUAL" {
  if (insurerCode === "LATINA") return latinaQuote(risk, coverageType, currentYear);
  if (insurerCode === "CONDOR") return condorQuote(risk, currentYear);
  return "MANUAL";
}
