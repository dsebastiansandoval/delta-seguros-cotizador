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
