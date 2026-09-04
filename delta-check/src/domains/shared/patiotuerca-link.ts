/**
 * Enlace de referencia (no integración) a la guía de precios de PatioTuerca
 * — investigado en vivo, ver ARCHITECTURE.md §13.1/§16: el precio real
 * ("Precio ideal/más bajo/más alto") vive incrustado en el HTML de cada
 * página `/precio/autos/{marca}/{modelo}/{año}`, no en una API pública.
 * Bajarlo por programa sería scraping — esto en cambio solo arma la URL
 * para que el agente la abra y la vea con sus propios ojos, igual que si
 * la hubiera escrito a mano.
 *
 * Patrón de slug confirmado navegando el sitio real, no adivinado:
 * espacios y puntos se reemplazan por "+", todo en minúsculas — "Corolla
 * 1.2" → "corolla+1+2", "Alfa Romeo" → "alfa+romeo".
 */
function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "+");
}

export function buildPatioTuercaUrl(brand: string, model: string, year: string): string | null {
  const b = slugify(brand);
  const m = slugify(model);
  const y = year.trim();
  if (!b || !m || !/^\d{4}$/.test(y)) return null;
  return `https://ecuador.patiotuerca.com/precio/autos/${b}/${m}/${y}`;
}
