/**
 * Dinero en centavos (bigint→number con mode:"number" en el esquema, ver
 * ARCHITECTURE.md §4.1). Nunca float — un error de redondeo en una prima o
 * una comisión no es aceptable. Todas las operaciones de dinero pasan por
 * acá, no se hace aritmética de centavos suelta en los servicios.
 */

/** USD con hasta 2 decimales → centavos enteros. Redondea, nunca trunca silenciosamente. */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

/** Porcentaje (ej. 3.5 → 0.035) aplicado a centavos, redondeado al centavo. */
export function applyPercent(cents: number, percent: number): number {
  return Math.round(cents * (percent / 100));
}

export function formatUSD(cents: number): string {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(
    centsToDollars(cents),
  );
}
