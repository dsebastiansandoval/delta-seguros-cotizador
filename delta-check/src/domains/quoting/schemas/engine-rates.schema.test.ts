import { describe, expect, it } from "vitest";
import { DEFAULT_ENGINE_RATES } from "../offer/excel-rates";
import { engineRatesSchema, firstIssue } from "./engine-rates.schema";

const clone = () => structuredClone(DEFAULT_ENGINE_RATES);

describe("engineRatesSchema", () => {
  it("acepta las tablas del Excel", () => {
    expect(engineRatesSchema.parse(clone())).toEqual(DEFAULT_ENGINE_RATES);
  });

  it("rechaza tramos de Latina desordenados", () => {
    const rates = clone();
    rates.latina.todoRiesgo.LIVIANO[1].from = 5000;
    const result = engineRatesSchema.safeParse(rates);
    expect(result.success).toBe(false);
    expect(firstIssue(result.error!)).toBe("Los tramos deben ir de menor a mayor valor");
  });

  it("rechaza una tasa digitada como porcentaje entero", () => {
    const rates = clone();
    rates.condor.bands.LIVIANO[0].rates[3] = 3;
    expect(firstIssue(engineRatesSchema.safeParse(rates).error!)).toBe("Tasa fuera de rango (máx. 50%)");
  });

  it("rechaza un tramo de Cóndor con desde > hasta o sin tasas", () => {
    const inverted = clone();
    inverted.condor.bands.PICKUP[0].from = 30000;
    expect(engineRatesSchema.safeParse(inverted).success).toBe(false);

    const empty = clone();
    empty.condor.bands.PICKUP[0].rates = Array(11).fill(null);
    expect(firstIssue(engineRatesSchema.safeParse(empty).error!)).toBe("Cada tramo necesita al menos una tasa");
  });
});
