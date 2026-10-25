/**
 * Motor de tasas de Latina y Cóndor — reproduce las fórmulas de DATOS OFERTA
 * (L31/L33 y O31/O33) y las tablas de INFO GENERAL (AF:AJ y AL:AV) de
 * COTIZADOR ACTUALIZADO.xlsm. Las otras 11 aseguradoras se digitan a mano.
 * Las tablas son configurables por organización (/admin/configuracion); los
 * valores de abajo son los del Excel y se usan mientras Delta no los cambie.
 */
export type CoverageType = "TODO_RIESGO" | "SOLO_PERDIDA_TOTAL";

export type RateRisk = {
  bodyType: string;
  vehicleYear: number;
  insuredValueCents: number;
  extrasValueCents: number;
};

export type EngineQuote = { netPremiumCents: number; rate: number } | null;

export const ENGINE_BODY_TYPES = ["LIVIANO", "PICKUP"] as const;
export type EngineBodyType = (typeof ENGINE_BODY_TYPES)[number];

/** Tramo de valor asegurado: aplica desde `from` dólares hasta el siguiente tramo. */
export type LatinaBracket = { from: number; rate: number };

export type LatinaRates = {
  todoRiesgo: Record<EngineBodyType, LatinaBracket[]>;
  soloPerdidaTotalRate: number;
};

/** Años de vehículo que cubre la tabla de Cóndor: columnas 0 a 10 de INFO GENERAL. */
export const CONDOR_YEAR_COLUMNS = 11;

/** Fila de Cóndor: casco entre `from` y `to` dólares; `rates[años]`, null = no asegurable. */
export type CondorBand = { from: number; to: number; rates: (number | null)[] };

export type CondorRates = {
  bands: Record<EngineBodyType, CondorBand[]>;
  minPremiumCents: number;
};

export type EngineRates = { latina: LatinaRates; condor: CondorRates };

// Límites de antigüedad de DATOS OFERTA!L33 — parte de la fórmula, no de la tabla.
const LATINA_TODO_RIESGO_MAX_AGE = 10;
const LATINA_SOLO_PT_MAX_AGE = 13;

export const DEFAULT_LATINA_RATES: LatinaRates = {
  // INFO GENERAL!AF7:AH11 y AF14:AH17 — VLOOKUP aproximado sobre DESDE.
  todoRiesgo: {
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
  },
  // INFO GENERAL!AJ7
  soloPerdidaTotalRate: 0.03,
};

function condorBand(from: number, to: number, firstYear: number, rates: number[]): CondorBand {
  return {
    from,
    to,
    rates: Array.from({ length: CONDOR_YEAR_COLUMNS }, (_, years) => rates[years - firstYear] ?? null),
  };
}

export const DEFAULT_CONDOR_RATES: CondorRates = {
  // INFO GENERAL!AL7:AO38 (LIVIANO) y AR7:AU44 (PICKUP), en el mismo orden de la hoja: si dos
  // filas se superponen, gana la primera (como el Excel).
  bands: {
    LIVIANO: [
      condorBand(0.01, 19999, 0, [0.03, 0.03, 0.03, 0.03, 0.034, 0.034, 0.038, 0.04, 0.042, 0.044, 0.047]),
      condorBand(20000, 24999, 1, [0.03, 0.03, 0.03, 0.03, 0.03, 0.033, 0.035, 0.037, 0.039, 0.041]),
      condorBand(25000, 79999, 0, [0.025, 0.025, 0.025, 0.025, 0.025, 0.025, 0.027, 0.027, 0.027, 0.031, 0.031]),
    ],
    PICKUP: [
      condorBand(0.01, 19999, 0, Array(11).fill(0.0356)),
      condorBand(20000, 24999, 1, Array(10).fill(0.0356)),
      condorBand(0.01, 44999, 0, Array(6).fill(0.0356)),
      condorBand(45000, 79999, 0, Array(6).fill(0.0356)),
      condorBand(25000, 79999, 6, Array(5).fill(0.0356)),
    ],
  },
  // DATOS OFERTA!O31: prima neta mínima de Cóndor.
  minPremiumCents: 40000,
};

export const DEFAULT_ENGINE_RATES: EngineRates = { latina: DEFAULT_LATINA_RATES, condor: DEFAULT_CONDOR_RATES };

export function latinaQuote(
  risk: RateRisk,
  coverageType: CoverageType,
  currentYear: number,
  rates: LatinaRates = DEFAULT_LATINA_RATES,
): EngineQuote {
  const age = currentYear - risk.vehicleYear;
  const valueCents = risk.insuredValueCents + risk.extrasValueCents;

  let rate: number | null = null;
  if (coverageType === "SOLO_PERDIDA_TOTAL") {
    if (age <= LATINA_SOLO_PT_MAX_AGE) rate = rates.soloPerdidaTotalRate;
  } else if (age <= LATINA_TODO_RIESGO_MAX_AGE) {
    const table = rates.todoRiesgo[risk.bodyType as EngineBodyType];
    if (table) {
      for (const bracket of table) {
        if (valueCents >= bracket.from * 100) rate = bracket.rate;
      }
    }
  }
  if (rate == null) return null;
  return { rate, netPremiumCents: Math.round(valueCents * rate) };
}

export function condorQuote(risk: RateRisk, currentYear: number, rates: CondorRates = DEFAULT_CONDOR_RATES): EngineQuote {
  const casco = risk.insuredValueCents / 100;
  const years = Math.max(1, currentYear - risk.vehicleYear + 1);
  const band = (rates.bands[risk.bodyType as EngineBodyType] ?? []).find(
    (b) => casco >= b.from && casco <= b.to && b.rates[years] != null,
  );
  const rate = band?.rates[years];
  if (rate == null) return null;
  const premium = Math.round((risk.insuredValueCents + risk.extrasValueCents) * rate);
  return { rate, netPremiumCents: Math.max(premium, rates.minPremiumCents) };
}

/** Aseguradoras con motor propio; el resto queda en digitación manual. */
export function engineQuote(
  insurerCode: string,
  risk: RateRisk,
  coverageType: CoverageType,
  currentYear: number,
  rates: EngineRates = DEFAULT_ENGINE_RATES,
): EngineQuote | "MANUAL" {
  if (insurerCode === "LATINA") return latinaQuote(risk, coverageType, currentYear, rates.latina);
  if (insurerCode === "CONDOR") return condorQuote(risk, currentYear, rates.condor);
  return "MANUAL";
}
