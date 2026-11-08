/**
 * Días transcurridos desde una fecha (date `YYYY-MM-DD`, sin hora) — el
 * "contador de días" que pidió David el 6-nov para Siniestros, desde
 * `reportedAt`. `null` si todavía no hay fecha de reporte.
 */
export function daysSince(dateIso: string | null, asOf: Date = new Date()): number | null {
  if (!dateIso) return null;
  const from = new Date(`${dateIso}T00:00:00Z`);
  const today = new Date(`${asOf.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((today.getTime() - from.getTime()) / 86_400_000);
}
