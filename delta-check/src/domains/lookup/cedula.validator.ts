/**
 * Validación de cédula ecuatoriana — algoritmo módulo 10 oficial (mismo que
 * usa el Registro Civil/SRI). Puramente local, no pega a ningún servicio:
 * evita gastar una consulta externa en un número que ya se sabe inválido.
 */
export function isValidCedula(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;

  const province = Number(value.slice(0, 2));
  if (province < 1 || province > 24) return false;

  const thirdDigit = Number(value[2]);
  if (thirdDigit > 6) return false; // 7/8/9 son RUC de sociedad, no cédula de persona natural

  const digits = value.split("").map(Number);
  const checkDigit = digits[9];

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = digits[i];
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }

  const expected = sum % 10 === 0 ? 0 : 10 - (sum % 10);
  return expected === checkDigit;
}

/** RUC de persona natural = cédula + "001" — la convención que usa el propio SRI. */
export function cedulaToNaturalPersonRuc(cedula: string): string {
  return `${cedula}001`;
}

/**
 * Los 2 primeros dígitos de la cédula son el código de provincia oficial
 * del INEC — el mismo que usa el Registro Civil para emitirla. Es dato
 * real, no un truco: se puede sugerir la provincia sin ninguna llamada
 * externa, ya que se valida el mismo prefijo en `isValidCedula`.
 *
 * Ojo con la semántica: es la provincia donde se **emitió** la cédula
 * (normalmente, donde la persona nació o se registró por primera vez), no
 * necesariamente donde vive hoy — se muestra como sugerencia a revisar,
 * nunca como un hecho verificado de residencia actual.
 */
const PROVINCE_BY_CODE: Record<string, string> = {
  "01": "Azuay",
  "02": "Bolívar",
  "03": "Cañar",
  "04": "Carchi",
  "05": "Cotopaxi",
  "06": "Chimborazo",
  "07": "El Oro",
  "08": "Esmeraldas",
  "09": "Guayas",
  "10": "Imbabura",
  "11": "Loja",
  "12": "Los Ríos",
  "13": "Manabí",
  "14": "Morona Santiago",
  "15": "Napo",
  "16": "Pastaza",
  "17": "Pichincha",
  "18": "Tungurahua",
  "19": "Zamora Chinchipe",
  "20": "Galápagos",
  "21": "Sucumbíos",
  "22": "Orellana",
  "23": "Santo Domingo de los Tsáchilas",
  "24": "Santa Elena",
};

/** Provincia sugerida por el prefijo de la cédula — null si no es una cédula válida de 10 dígitos. */
export function provinceFromCedula(cedula: string): string | null {
  if (!/^\d{10}$/.test(cedula)) return null;
  return PROVINCE_BY_CODE[cedula.slice(0, 2)] ?? null;
}

/**
 * Las 24 provincias reales de Ecuador, para un selector — misma fuente que
 * `provinceFromCedula`, ordenadas alfabéticamente (el código INEC no es un
 * orden útil para elegir en un `<select>`). No se sacó de EcuadorAPI.com
 * ni de ningún tercero: no tiene un catálogo de provincias consultable
 * pese a mencionarlo en su descripción (confirmado leyendo su
 * `/api/schema/` completo, no solo la lista de URLs de marketing) — esta
 * lista ya la teníamos, del propio INEC vía el prefijo de cédula.
 */
export const ECUADOR_PROVINCES: string[] = Object.values(PROVINCE_BY_CODE).sort((a, b) => a.localeCompare(b, "es"));
