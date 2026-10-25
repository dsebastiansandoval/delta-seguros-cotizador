import { describe, expect, it } from "vitest";
import { healthPremium } from "./health-premium";
import { HEALTH_PLANS } from "../health-plans.generated";

describe("healthPremium (OFERTA AM filas 63-67)", () => {
  it("suma OTROS CARGOS a la neta y cobra 0.5% de Seguro Campesino sobre el subtotal", () => {
    // STAR 15-70 de dos personas: 137.59 + 28.32 = 165.91; 0.5% = 0.83; total 166.74
    expect(healthPremium(13759, 2832)).toEqual({
      netPremiumCents: 13759,
      emissionFeeCents: 2832,
      campesinoCents: 83,
      totalPremiumCents: 16674,
    });
  });
});

describe("catálogo de planes generado desde OFERTA AM", () => {
  it("GMM de BMI tiene otros cargos de $65, distinto a Sigma ($80)", () => {
    const otros = (code: string) => HEALTH_PLANS.find((p) => p.planCode === code)?.otrosCargosCents;
    expect(otros("GMM_5K")).toBe(6500);
    expect(otros("SIGMA_D150")).toBe(8000);
  });

  it("los 9 planes de BUPA son manuales (el Excel no trae tarifa)", () => {
    const bupa = HEALTH_PLANS.filter((p) => p.insurerCode === "BUPA");
    expect(bupa).toHaveLength(9);
    expect(bupa.every((p) => p.manual)).toBe(true);
  });
});
