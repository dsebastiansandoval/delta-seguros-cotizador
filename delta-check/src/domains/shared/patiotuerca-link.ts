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

/**
 * El campo "Modelo" del formulario suele traer la ficha técnica completa
 * del vehículo (ej. "301 ALL 1.6E B5 AC 1.6 4P 4X2 TM" — importa para
 * cotizar el seguro), pero PatioTuerca solo reconoce el código base del
 * modelo ("301") en su URL; mandarle la ficha completa rompe el link
 * (confirmado real: /peugeot/301+all+16e+.../2020 no existe, el real es
 * /peugeot/301/2020). Si el texto escrito empieza con una entrada real del
 * catálogo (`knownModels`, el mismo que llena el datalist de "Modelo"), se
 * usa esa entrada — ya viene limpia. El más largo que matchea gana (para
 * que "CX30" no se recorte a "CX3" cuando el catálogo trae ambos). Sin
 * match, se usa el texto tal cual, igual que siempre.
 */
function resolveModelBase(model: string, knownModels: string[]): string {
  const normalized = model.trim().toUpperCase();
  const match = knownModels
    .map((known) => known.trim())
    .filter((known) => {
      const upper = known.toUpperCase();
      return normalized === upper || normalized.startsWith(`${upper} `);
    })
    .sort((a, b) => b.length - a.length)[0];
  return match ?? model;
}

export function buildPatioTuercaUrl(brand: string, model: string, year: string, knownModels: string[] = []): string | null {
  const b = slugify(brand);
  const y = year.trim();
  if (!b || !model.trim() || !/^\d{4}$/.test(y)) return null;
  const m = slugify(resolveModelBase(model, knownModels));
  if (!m) return null;
  return `https://ecuador.patiotuerca.com/precio/autos/${b}/${m}/${y}`;
}
