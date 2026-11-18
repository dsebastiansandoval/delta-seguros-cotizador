import type { CaratulaAMMember, CaratulaAMOffer } from "./caratula-am.service";

/** OFERTA AM guarda coparticipaciones como decimales (0.8 = 80%); el resto se muestra tal cual. */
function formatCoverageField(value: string | null): string | null {
  if (!value) return value;
  const n = Number(value);
  if (!Number.isNaN(n) && value.trim() === String(n) && n >= 0 && n <= 1) {
    return `${Math.round(n * 100)}%`;
  }
  return value;
}

/** Copago · sublímite · carencia de una fila de cobertura. */
export function formatCoverageValue(row: { copago: string | null; sublimite: string | null; carencia: string | null }): string {
  return [formatCoverageField(row.copago), formatCoverageField(row.sublimite), formatCoverageField(row.carencia)]
    .filter(Boolean)
    .join(" · ") || "—";
}

/** "Titular — 35 años, masculino", "Dependiente 1 — …" (OFERTA AM filas 56-61). */
export function memberLabels(members: CaratulaAMMember[]): string[] {
  let depIndex = 0;
  return members.map((m) => {
    const relation = m.relation === "TITULAR" ? "Titular" : `Dependiente ${(depIndex += 1)}`;
    return `${relation} — ${m.age} años, ${m.gender === "MASCULINO" ? "masculino" : "femenino"}`;
  });
}

/** "10K_RED1_CON_MATERNIDAD" → "10K RED1 CON MATERNIDAD". */
export function planLabel(planCode: string | null): string {
  return (planCode ?? "—").replace(/_/g, " ");
}

/**
 * Agrupa los planes de una aseguradora por familia base, cuando varios
 * códigos son el mismo plan con distinto deducible — p.ej. STAR_15_70,
 * STAR_15_70_1500 y STAR_15_70_2500 son la misma familia "STAR 15 70" con
 * 3 deducibles (pedido de Delta: verlos juntos, ej. "STAR 15"). No es una
 * estructura que exista en el Excel real — sus encabezados de columna son
 * planos, sin celda combinada que agrupe estas variantes (confirmado
 * revisando OFERTA AM!8:8 y sus macros MOSTRAR_OCULTAR, una por columna,
 * sin jerarquía) — se deriva acá por patrón de nombre: un código es
 * "variante" de otro código más corto de la misma aseguradora si es ese
 * código + "_" + solo dígitos (el deducible). CON_MATERNIDAD/SIN_MATERNIDAD
 * no cuenta para esto — se ignora al comparar, así ambas variantes caen en
 * la misma familia.
 */
export function groupHealthPlansByFamily<T extends { planCode: string | null }>(
  rows: T[],
): Array<{ family: string; rows: T[] }> {
  const stripMaternidad = (code: string) => code.replace(/_(CON|SIN)_MATERNIDAD$/, "");
  const baseCodes = new Set(
    rows.map((r) => (r.planCode ? stripMaternidad(r.planCode) : null)).filter((c): c is string => c != null),
  );

  function familyOf(planCode: string | null): string {
    if (!planCode) return "—";
    const base = stripMaternidad(planCode);
    let best: string | null = null;
    for (const candidate of baseCodes) {
      if (candidate === base) continue;
      if (base.startsWith(`${candidate}_`) && /^\d+$/.test(base.slice(candidate.length + 1))) {
        if (!best || candidate.length > best.length) best = candidate;
      }
    }
    return (best ?? base).replace(/_/g, " ");
  }

  const order: string[] = [];
  const byFamily = new Map<string, T[]>();
  for (const row of rows) {
    const family = familyOf(row.planCode);
    if (!byFamily.has(family)) {
      byFamily.set(family, []);
      order.push(family);
    }
    byFamily.get(family)!.push(row);
  }
  return order.map((family) => ({ family, rows: byFamily.get(family)! }));
}

/** Filas de cobertura de todos los planes, en el orden del Excel, marcando dónde empieza cada sección. */
export function coverageRows(offers: CaratulaAMOffer[]) {
  const byLabel = new Map<string, { section: string; displayOrder: number }>();
  for (const offer of offers) {
    for (const c of offer.coverages) {
      if (!byLabel.has(c.label)) byLabel.set(c.label, { section: c.section, displayOrder: c.displayOrder });
    }
  }
  const ordered = [...byLabel.entries()].sort((a, b) => a[1].displayOrder - b[1].displayOrder);
  return ordered.map(([label, { section }], i) => ({
    label,
    section,
    showSectionHeader: i === 0 || section !== ordered[i - 1][1].section,
  }));
}

export function coverageValueFor(offer: CaratulaAMOffer, label: string): string {
  const row = offer.coverages.find((c) => c.label === label);
  return row ? formatCoverageValue(row) : "—";
}
