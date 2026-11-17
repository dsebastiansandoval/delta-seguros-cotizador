/**
 * Edad exacta a partir de fecha de nacimiento — resta el año y ajusta si
 * todavía no pasó el cumpleaños este año (una resta simple de años se
 * equivoca justo en ese caso). `insured_members.birth_date` ya existía en
 * el esquema desde Fase 2 pero nunca se usaba — el formulario pedía la
 * edad como número suelto, que se desactualiza cada año.
 */
export function calculateAge(birthDateIso: string, asOf: Date = new Date()): number {
  const birthDate = new Date(birthDateIso);
  let age = asOf.getUTCFullYear() - birthDate.getUTCFullYear();

  const asOfMonthDay = asOf.getUTCMonth() * 100 + asOf.getUTCDate();
  const birthMonthDay = birthDate.getUTCMonth() * 100 + birthDate.getUTCDate();
  if (asOfMonthDay < birthMonthDay) age -= 1;

  return age;
}

/**
 * `ageInput` (edad digitada directa) gana si está presente; si no, se
 * calcula desde `birthDate` — mismo criterio en los dos lugares que piden
 * "fecha de nacimiento O edad" (alta y edición de titular/dependiente de
 * Salud, health-quote.schema.ts y client.schema.ts).
 */
export function resolveAge(birthDate: string | undefined, ageInput: string | undefined): number | undefined {
  if (ageInput != null) {
    const n = Number(ageInput);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }
  if (birthDate) return calculateAge(birthDate);
  return undefined;
}
