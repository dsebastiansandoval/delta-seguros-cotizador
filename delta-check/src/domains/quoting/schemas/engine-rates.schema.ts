import { z } from "zod";
import { CONDOR_YEAR_COLUMNS, type EngineRates } from "../offer/excel-rates";

export const ENGINE_RATES_SETTING_KEY = "autos.engine_rates";

// Tasas como fracción (0.032 = 3,2%), igual que el Excel. Más de 50% es un error de tipeo.
const rate = z
  .number({ error: "Hay una tasa vacía o que no es un número" })
  .gt(0, "Tasa debe ser mayor a 0")
  .lt(0.5, "Tasa fuera de rango (máx. 50%)");
const dollars = z.number({ error: "Hay un monto vacío o que no es un número" }).min(0, "Monto negativo");

const latinaBrackets = z
  .array(z.object({ from: dollars, rate }))
  .min(1, "Cada tipo de vehículo necesita al menos un tramo")
  .refine((list) => list.every((b, i) => i === 0 || b.from > list[i - 1].from), "Los tramos deben ir de menor a mayor valor");

const condorBands = z
  .array(
    z
      .object({ from: dollars, to: dollars, rates: z.array(rate.nullable()).length(CONDOR_YEAR_COLUMNS) })
      .refine((b) => b.from <= b.to, "En un tramo, 'desde' no puede ser mayor que 'hasta'")
      .refine((b) => b.rates.some((r) => r != null), "Cada tramo necesita al menos una tasa"),
  )
  .min(1, "Cada tipo de vehículo necesita al menos un tramo");

export const engineRatesSchema = z.object({
  latina: z.object({
    todoRiesgo: z.object({ LIVIANO: latinaBrackets, PICKUP: latinaBrackets }),
    soloPerdidaTotalRate: rate,
  }),
  condor: z.object({
    bands: z.object({ LIVIANO: condorBands, PICKUP: condorBands }),
    minPremiumCents: z.number({ error: "Prima mínima inválida" }).int().min(0, "Prima mínima inválida"),
  }),
}) satisfies z.ZodType<EngineRates>;

/** Primer mensaje de error legible — el formulario muestra uno a la vez. */
export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Datos inválidos";
}
