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
