/**
 * La primera letra de la placa ecuatoriana indica la provincia donde se
 * matriculó el vehículo por primera vez — tabla oficial (ANT), verificada
 * contra 2 fuentes independientes antes de usarla acá (nunca se fabrica un
 * dato así sin confirmarlo). 24 letras, una por cada una de las 24
 * provincias — mismos nombres/ortografía que `ECUADOR_PROVINCES`
 * (cedula.validator.ts) para que el valor calce exacto con las opciones
 * del `<select>`.
 *
 * Igual que `provinceFromCedula`: es una sugerencia a partir de dónde se
 * matriculó el vehículo, no un hecho que el agente no pueda corregir — el
 * dueño pudo haberse mudado o revender el auto entre provincias después.
 */
const PROVINCE_BY_PLATE_LETTER: Record<string, string> = {
  A: "Azuay",
  B: "Bolívar",
  C: "Carchi",
  E: "Esmeraldas",
  G: "Guayas",
  H: "Chimborazo",
  I: "Imbabura",
  J: "Santo Domingo de los Tsáchilas",
  K: "Sucumbíos",
  L: "Loja",
  M: "Manabí",
  N: "Napo",
  O: "El Oro",
  P: "Pichincha",
  Q: "Orellana",
  R: "Los Ríos",
  S: "Pastaza",
  T: "Tungurahua",
  U: "Cañar",
  V: "Morona Santiago",
  W: "Galápagos",
  X: "Cotopaxi",
  Y: "Santa Elena",
  Z: "Zamora Chinchipe",
};

/** Provincia sugerida por la primera letra de la placa — null si no reconoce la letra. */
export function provinceFromPlate(plate: string): string | null {
  const firstLetter = plate.trim().toUpperCase()[0];
  return firstLetter ? (PROVINCE_BY_PLATE_LETTER[firstLetter] ?? null) : null;
}
