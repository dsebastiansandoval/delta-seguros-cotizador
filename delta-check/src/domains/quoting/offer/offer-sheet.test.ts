import { describe, expect, it } from "vitest";
import { buildOfferColumn, combineRiskPremiums, type InsurerSettingsValues } from "./offer-sheet";
import { INSURER_OFFER_PROFILES } from "./insurer-offer-profiles";

const settings = (over: Partial<InsurerSettingsValues> = {}): InsurerSettingsValues => ({
  included: true,
  coverageType: "TODO_RIESGO",
  amparoPatrimonial: true,
  rcAmountCents: 4_000_000,
  gmAmountCents: 300_000,
  partialDeductible: "* 10% VS, 1% VA, mínimo USD 200 (el que sea mayor)",
  totalLossDeductible: "* 20% del VA",
  ...over,
});

describe("combineRiskPremiums", () => {
  it("suma las primas netas de todos los riesgos e impone sobre la suma", () => {
    const totals = combineRiskPremiums([
      { quoteOptionId: "a", riskNumber: 1, netPremiumCents: 76000, ratePercentApplied: null },
      { quoteOptionId: "b", riskNumber: 2, netPremiumCents: 24000, ratePercentApplied: null },
    ]);
    expect(totals?.netPremiumCents).toBe(100000);
    expect(totals?.superBancosCents).toBe(3500);
  });

  it("el derecho de emisión se calcula por riesgo y se suma, no sobre la neta combinada (OFERTA!I45)", () => {
    const totals = combineRiskPremiums([
      // $760 → tramo $3; $24 → tramo $0.50 (si se buscara contra la suma, $1000 caería en el tramo $5)
      { quoteOptionId: "a", riskNumber: 1, netPremiumCents: 76000, ratePercentApplied: null },
      { quoteOptionId: "b", riskNumber: 2, netPremiumCents: 2400, ratePercentApplied: null },
    ]);
    expect(totals?.emissionFeeCents).toBe(350);
  });

  it("devuelve null si ningún riesgo tiene prima", () => {
    expect(combineRiskPremiums([{ quoteOptionId: "a", riskNumber: 1, netPremiumCents: null, ratePercentApplied: null }])).toBeNull();
  });
});

describe("buildOfferColumn", () => {
  const base = { insurerId: "i", insurerName: "AIG", snapshot: INSURER_OFFER_PROFILES.AIG.rows, risks: [] };

  it("solo pérdida total cambia pérdida parcial, robo parcial y el deducible parcial", () => {
    const col = buildOfferColumn({ ...base, settings: settings({ coverageType: "SOLO_PERDIDA_TOTAL" }) });
    expect(col.cells.PERDIDA_PARCIAL.text).toBe("Solo pérdida total");
    expect(col.cells.ROBO_PARCIAL.text).toBe("Solo pérdida total");
    expect(col.cells.PERDIDA_TOTAL.text).toBe("Sí otorga");
    expect(col.partialDeductible).toBe("Solo pérdida total");
  });

  it("aplica RC, GM y amparo elegidos en la configuración", () => {
    const col = buildOfferColumn({
      ...base,
      settings: settings({ rcAmountCents: 10_000_000, gmAmountCents: 500_000, amparoPatrimonial: false }),
    });
    expect(col.cells.RC).toEqual({ amount: 100000, text: "sin costo" });
    expect(col.cells.GM.amount).toBe(5000);
    expect(col.cells.AMPARO_PATRIMONIAL.text).toBe("No otorga");
  });
});
