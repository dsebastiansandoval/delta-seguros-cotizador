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
