/**
 * `razonSocial` de persona natural en el SRI sigue el orden fijo de la
 * cédula ecuatoriana: "APELLIDO1 APELLIDO2 NOMBRE1 [NOMBRE2...]" — siempre
 * 2 apellidos, 1 o más nombres. Partirlo así es la convención real, no una
 * suposición arbitraria.
 */
export function splitRazonSocial(razonSocial: string): { firstName: string; lastName: string } {
  const words = razonSocial.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { firstName: "", lastName: "" };

  // Deja al menos 1 palabra para el nombre — con solo 2 palabras en total,
  // "apellido nombre" es más útil que "apellido apellido" sin nombre.
  const lastNameWordCount = words.length >= 2 ? Math.min(2, words.length - 1) : 0;
  const lastName = words.slice(0, lastNameWordCount).join(" ");
  const firstName = words.slice(lastNameWordCount).join(" ");
  return { firstName, lastName };
}
