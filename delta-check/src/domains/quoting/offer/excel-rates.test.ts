import { describe, expect, it } from "vitest";
import { condorQuote, latinaQuote, type RateRisk } from "./excel-rates";

const risk = (over: Partial<RateRisk> = {}): RateRisk => ({
  bodyType: "LIVIANO",
  vehicleYear: 2022,
  insuredValueCents: 2_000_000,
  extrasValueCents: 0,
  ...over,
});

describe("latinaQuote (DATOS OFERTA!L33)", () => {
  it("todo riesgo usa la tabla por valor (casco + extras) con VLOOKUP aproximado", () => {
    expect(latinaQuote(risk(), "TODO_RIESGO", 2026)).toEqual({ rate: 0.032, netPremiumCents: 64000 });
    // 19.500 + 1.000 de extras = 20.500 → tramo 20.000
    expect(latinaQuote(risk({ insuredValueCents: 1_950_000, extrasValueCents: 100_000 }), "TODO_RIESGO", 2026)?.rate).toBe(0.032);
    // 14.999,50 cae en el tramo 10.000 (no hay hueco entre 14.999 y 15.000)
    expect(latinaQuote(risk({ insuredValueCents: 1_499_950 }), "TODO_RIESGO", 2026)?.rate).toBe(0.051);
  });

  it("todo riesgo no cotiza vehículos de más de 10 años ni valores bajo 10.000", () => {
    expect(latinaQuote(risk({ vehicleYear: 2015 }), "TODO_RIESGO", 2026)).toBeNull();
    expect(latinaQuote(risk({ insuredValueCents: 900_000 }), "TODO_RIESGO", 2026)).toBeNull();
  });

  it("solo pérdida total aplica la tasa plana del 3% hasta 13 años, sin importar el valor", () => {
    expect(latinaQuote(risk({ vehicleYear: 2013 }), "SOLO_PERDIDA_TOTAL", 2026)).toEqual({ rate: 0.03, netPremiumCents: 60000 });
    expect(latinaQuote(risk({ vehicleYear: 2012 }), "SOLO_PERDIDA_TOTAL", 2026)).toBeNull();
  });
});

describe("condorQuote (DATOS OFERTA!O31/O33)", () => {
  it("busca por banda de casco y años exactos (año actual - modelo + 1)", () => {
    // 2022 → 5 años → banda 20.000-24.999 → 3%
    expect(condorQuote(risk(), 2026)).toEqual({ rate: 0.03, netPremiumCents: 60000 });
    // 2018 → 9 años → 3.9%
    expect(condorQuote(risk({ vehicleYear: 2018 }), 2026)?.rate).toBe(0.039);
  });

  it("aplica la prima mínima de 400", () => {
    // 10.000 × 3.4% (banda baja, 5 años) = 340 → sube a 400
    expect(condorQuote(risk({ insuredValueCents: 1_000_000 }), 2026)).toEqual({ rate: 0.034, netPremiumCents: 40000 });
  });

  it("no cotiza fuera de tabla: más de 10 años o casco sobre 79.999", () => {
    expect(condorQuote(risk({ vehicleYear: 2015 }), 2026)).toBeNull();
    expect(condorQuote(risk({ insuredValueCents: 8_000_000 }), 2026)).toBeNull();
  });

  it("pickup es 3.56% plano dentro de la tabla", () => {
    expect(condorQuote(risk({ bodyType: "PICKUP", insuredValueCents: 3_000_000 }), 2026)?.rate).toBe(0.0356);
  });
});
