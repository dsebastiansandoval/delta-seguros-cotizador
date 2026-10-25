import { describe, expect, it } from "vitest";
import { calculatePremium, emissionFeeForNetPremium, premiumFromTotal } from "./premium.calculator";

describe("calculatePremium", () => {
  it("reproduce la fórmula real de OFERTA!I42:I47 del Excel", () => {
    // Vehículo de USD 20.000 al 3.8% (tramo VH real de INFO GENERAL!AF22:AI25,
    // reference-data/autos_tasas_latina_condor_y_cargos.csv) → neta = 760.00
    const netPremiumCents = 76000; // $760.00
    const emissionFeeCents = emissionFeeForNetPremium(netPremiumCents);

    const result = calculatePremium(netPremiumCents, emissionFeeCents);

    // SB 3.5% de 760 = 26.60 → 2660
    expect(result.superBancosCents).toBe(2660);
    // Seguro campesino 0.5% de 760 = 3.80 → 380
    expect(result.campesinoCents).toBe(380);
    // Derechos de emisión: 760 cae en el tramo 501–1000 → $3.00 (INFO GENERAL!T8:V8)
    expect(result.emissionFeeCents).toBe(300);
    // Base gravable = 760 + 26.60 + 3.80 + 3.00 = 793.40
    // IVA 15% de 793.40 = 119.01 → 11901
    expect(result.ivaCents).toBe(11901);
    // Total = 793.40 + 119.01 = 912.41
    expect(result.totalPremiumCents).toBe(91241);
  });

  it("nunca calcula IVA solo sobre la prima neta — tiene que incluir SB, campesino y emisión", () => {
    const result = calculatePremium(100000, 500);
    const ivaSoloSobreNeta = Math.round(100000 * 0.15);
    expect(result.ivaCents).not.toBe(ivaSoloSobreNeta);
  });
});

describe("emissionFeeForNetPremium", () => {
  it("usa los tramos reales de INFO GENERAL!T6:V11", () => {
    expect(emissionFeeForNetPremium(20000)).toBe(50); // $200 → tramo 0-250
    expect(emissionFeeForNetPremium(30000)).toBe(100); // $300 → tramo 251-500
    expect(emissionFeeForNetPremium(150000)).toBe(500); // $1500 → tramo 1001-2000
    expect(emissionFeeForNetPremium(1000000)).toBe(900); // $10000 → tramo 4001+
  });

  it("una neta con centavos entre tramos cae en el tramo anterior, como el VLOOKUP del Excel", () => {
    expect(emissionFeeForNetPremium(25050)).toBe(50); // $250.50 → sigue en 0-250
    expect(emissionFeeForNetPremium(100050)).toBe(300); // $1000.50 → sigue en 501-1000
    expect(emissionFeeForNetPremium(400000)).toBe(900); // $4000 → la hoja dice DESDE 4000
  });
});

describe("premiumFromTotal", () => {
  it("despeja la neta de Auto x Km igual que OFERTA KM!H37 cuando el derecho es $0.50", () => {
    // PT digitado $239.78 → neta Excel = (239.78 - 0.5*1.15) / 1.196 = 200.00
    const result = premiumFromTotal(23978);
    expect(result.netPremiumCents).toBe(20000);
    expect(result.emissionFeeCents).toBe(50);
    expect(result.totalPremiumCents).toBe(23978);
  });

  it("usa el derecho del tramo real cuando la neta despejada pasa de $250", () => {
    const fromNet = calculatePremium(76000, emissionFeeForNetPremium(76000)); // total 912.41
    const result = premiumFromTotal(fromNet.totalPremiumCents);
    expect(result.netPremiumCents).toBe(76000);
    expect(result.emissionFeeCents).toBe(300);
  });

  it("siempre queda a lo más a un centavo del total digitado", () => {
    for (const total of [5000, 12345, 48999, 99999, 250001, 777777]) {
      expect(Math.abs(premiumFromTotal(total).totalPremiumCents - total)).toBeLessThanOrEqual(1);
    }
  });
});
