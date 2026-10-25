/**
 * Mecanismo de descuento de `OFERTA AM` (filas 69/71/73: TOTAL SIN
 * DESCUENTO / CON DESCUENTO ESPECIAL / CON DESCUENTO DE CONTADO) —
 * verificado celda por celda contra el Excel real y contra un PDF real de
 * cotización (COTIZACION 30K+50 HUMANA.pdf, coincide exacto: $304,35 sin
 * descuento SaludSA, $438,77→$372,96 con descuento especial Humana).
 *
 * `TOTAL SIN DESCUENTO` = PRIMA TOTAL / 12 (cuota mensual regular, todas
 * las aseguradoras).
 *
 * `TOTAL CON DESCUENTO ESPECIAL`/`DE CONTADO` = ((PRIMA_NETA − PRIMA_NETA×%
 * + OTROS_CARGOS) × 1.005) / 12, con %/condición que varía por aseguradora
 * y a veces por línea de plan dentro de la misma aseguradora (SaludSA y
 * Humana tienen más de una tabla real). `null` = "N/A" en el Excel real —
 * nunca se fabrica un descuento que la aseguradora no ofrece.
 *
 * Las tablas "por tamaño de grupo" (`BASES ASEGURADORAS AM`) solo aplican
 * si el grupo tiene más de 1 miembro (`IF(COUNT(...)>1, VLOOKUP(...), "")`
 * en el Excel real) — BMI es la única excepción, su 5%/9.09% son fijos sin
 * esa condición.
 */

type DiscountRule =
  | { kind: "NONE" }
  | { kind: "FIXED"; specialPercent: number; cashPercent: number | null }
  | { kind: "BY_GROUP_SIZE"; table: Record<number, number>; cashPercent: number | null };

// Humana — PRACTIHUMANA 15K (BASES ASEGURADORAS AM!$AA$10:$AC$17, COTIZADOR ACTUALIZADO.xlsm)
const PH15_TABLE: Record<number, number> = { 1: 0, 2: 0, 3: 0.23, 4: 0.3, 5: 0.3, 6: 0.3, 7: 0.3 };
// Humana — PRACTIHUMANA 30K ($W$10:$Y$17)
const PH30_TABLE: Record<number, number> = { 1: 0, 2: 0.09, 3: 0.17, 4: 0.24, 5: 0.3, 6: 0.3, 7: 0.3 };
// Humana — PRACTIHUMANA 50K ($S$11:$U$14) — el Excel real solo define hasta 4
// miembros; para grupos mayores se usa el último tramo conocido (30%), no un
// valor inventado más alto.
const PH50_TABLE: Record<number, number> = { 1: 0, 2: 0.15, 3: 0.23, 4: 0.3 };
// Humana — METROHUMANA 50K/80K/150K ($S$11:$U$17)
const MH_TABLE: Record<number, number> = { 1: 0, 2: 0.15, 3: 0.23, 4: 0.3, 5: 0.36, 6: 0.41, 7: 0.45 };
// SALUD genérico — STAR/SKY/PRO 150/PRO 500 ($EP$178:$EV$181)
const SALUD_GENERICO_TABLE: Record<number, number> = { 1: 0, 2: 0.03, 3: 0.05, 4: 0.07 };
// SaludSA — UNICO/ESENCIAL/PRACTICO/IDEAL/ELITE/PRIVILEGIO ($ET$178:$EV$181) — siempre 0%.
const SALUDSA_TABLE: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

function humanaRule(planCode: string): DiscountRule {
  if (planCode.startsWith("PRACTIHUMANA_15")) return { kind: "BY_GROUP_SIZE", table: PH15_TABLE, cashPercent: null };
  if (planCode.startsWith("PRACTIHUMANA_30")) return { kind: "BY_GROUP_SIZE", table: PH30_TABLE, cashPercent: null };
  if (planCode.startsWith("PRACTIHUMANA_50")) return { kind: "BY_GROUP_SIZE", table: PH50_TABLE, cashPercent: null };
  if (planCode.startsWith("METROHUMANA")) return { kind: "BY_GROUP_SIZE", table: MH_TABLE, cashPercent: null };
  return { kind: "NONE" };
}

function discountRuleFor(insurerCode: string, planCode: string): DiscountRule {
  switch (insurerCode) {
    case "BMI":
      return { kind: "FIXED", specialPercent: 0.05, cashPercent: 0.0909 };
    case "SALUD":
      return { kind: "BY_GROUP_SIZE", table: SALUD_GENERICO_TABLE, cashPercent: null };
    case "SALUDSA":
      return { kind: "BY_GROUP_SIZE", table: SALUDSA_TABLE, cashPercent: null };
    case "HUMANA":
      return humanaRule(planCode);
    case "CONFIAMED":
    case "PRO":
    case "VB":
    case "BUPA":
    default:
      return { kind: "NONE" };
  }
}

function percentForGroupSize(table: Record<number, number>, groupSize: number): number | null {
  if (groupSize <= 1) return null; // el Excel real solo aplica el VLOOKUP cuando COUNT(miembros)>1
  const maxKnown = Math.max(...Object.keys(table).map(Number));
  const key = Math.min(groupSize, maxKnown);
  return table[key] ?? null;
}

function monthlyWithDiscount(netPremiumCents: number, otrosCargosCents: number, percent: number): number {
  const discountedNet = netPremiumCents - netPremiumCents * percent;
  const withCampesino = (discountedNet + otrosCargosCents) * 1.005;
  return Math.round(withCampesino / 12);
}

export type HealthDiscounts = {
  sinDescuentoCents: number;
  conDescuentoEspecialCents: number | null;
  conDescuentoContadoCents: number | null;
};

export function calculateHealthDiscounts(
  insurerCode: string,
  planCode: string,
  groupSize: number,
  netPremiumCents: number,
  otrosCargosCents: number,
  totalPremiumCents: number,
): HealthDiscounts {
  const rule = discountRuleFor(insurerCode, planCode);
  const sinDescuentoCents = Math.round(totalPremiumCents / 12);

  if (rule.kind === "NONE") {
    return { sinDescuentoCents, conDescuentoEspecialCents: null, conDescuentoContadoCents: null };
  }

  if (rule.kind === "FIXED") {
    return {
      sinDescuentoCents,
      conDescuentoEspecialCents: monthlyWithDiscount(netPremiumCents, otrosCargosCents, rule.specialPercent),
      conDescuentoContadoCents:
        rule.cashPercent != null ? monthlyWithDiscount(netPremiumCents, otrosCargosCents, rule.cashPercent) : null,
    };
  }

  // BY_GROUP_SIZE
  const percent = percentForGroupSize(rule.table, groupSize);
  return {
    sinDescuentoCents,
    conDescuentoEspecialCents: percent != null ? monthlyWithDiscount(netPremiumCents, otrosCargosCents, percent) : null,
    conDescuentoContadoCents: null,
  };
}
