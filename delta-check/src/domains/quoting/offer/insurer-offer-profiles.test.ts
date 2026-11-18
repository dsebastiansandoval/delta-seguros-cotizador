import { describe, expect, it } from "vitest";
import { INSURER_OFFER_PROFILES, effectiveRcAmountCents } from "./insurer-offer-profiles";

/** Acta 17-nov-2026 con Delta (ARCHITECTURE.md §37) — valores que no están en el Excel del repo. */
describe("perfiles de oferta — ajustes de RSC y deducible", () => {
  it("Sweaden ofrece las siete RSC del acta, incluida 50.000", () => {
    expect(INSURER_OFFER_PROFILES.SWEADEN.options.rc).toEqual([
      10000, 15000, 20000, 25000, 30000, 35000, 50000,
    ]);
  });

  it("Sweaden ofrece el deducible 15% VS sin cambiar el default 12%", () => {
    expect(INSURER_OFFER_PROFILES.SWEADEN.options.partialDeductibleParts?.vs).toContain("* 15% VS, ");
    expect(INSURER_OFFER_PROFILES.SWEADEN.defaults.partialDeductible).toContain("12% VS");
  });

  it("Equisuiza (código SESA) tiene RC fija de 80.000 y sin selector", () => {
    const sesa = INSURER_OFFER_PROFILES.SESA;
    expect(sesa.rows.RC.amount).toBe(80000);
    expect(sesa.defaults.rcAmount).toBe(80000);
    expect(sesa.options.rc).toBeUndefined();
  });

  it("Equisuiza muestra 80.000 aunque la cotización guardara el 35.000 anterior al acta", () => {
    const sesa = INSURER_OFFER_PROFILES.SESA;
    expect(effectiveRcAmountCents(sesa, sesa.options, 3_500_000)).toBe(8_000_000);
  });

  it("con selector se respeta el monto guardado", () => {
    const aig = INSURER_OFFER_PROFILES.AIG;
    expect(effectiveRcAmountCents(aig, aig.options, 5_000_000)).toBe(5_000_000);
  });
});
