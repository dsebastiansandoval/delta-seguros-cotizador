import { describe, expect, it } from "vitest";
import { groupHealthPlansByFamily } from "./health-offer-format";

describe("groupHealthPlansByFamily", () => {
  it("agrupa los deducibles de un mismo plan SaludSA bajo su familia base", () => {
    const rows = [
      { planCode: "STAR_15_70_2500" },
      { planCode: "STAR_15_70_1500" },
      { planCode: "STAR_15_70" },
      { planCode: "STAR_30_90" },
      { planCode: "STAR_30_90_5000" },
    ];
    const groups = groupHealthPlansByFamily(rows);
    expect(groups.map((g) => g.family)).toEqual(["STAR 15 70", "STAR 30 90"]);
    expect(groups[0].rows.map((r) => r.planCode)).toEqual(["STAR_15_70_2500", "STAR_15_70_1500", "STAR_15_70"]);
    expect(groups[1].rows.map((r) => r.planCode)).toEqual(["STAR_30_90", "STAR_30_90_5000"]);
  });

  it("no mezcla bases distintas de SKY aunque compartan el mismo prefijo (100 vs 200 vs 500)", () => {
    const rows = [
      { planCode: "SKY_70_PLUS_100" },
      { planCode: "SKY_70_PLUS_100_1500" },
      { planCode: "SKY_70_PLUS_200" },
      { planCode: "SKY_70_PLUS_200_2500" },
    ];
    const groups = groupHealthPlansByFamily(rows);
    expect(groups.map((g) => g.family)).toEqual(["SKY 70 PLUS 100", "SKY 70 PLUS 200"]);
  });

  it("CON MATERNIDAD y SIN MATERNIDAD del mismo plan caen en la misma familia", () => {
    const rows = [{ planCode: "UNICO_7K_CON_MATERNIDAD" }, { planCode: "UNICO_7K_SIN_MATERNIDAD" }];
    const groups = groupHealthPlansByFamily(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].family).toBe("UNICO 7K");
  });

  it("un plan sin variantes queda solo en su propia familia (SIGMA de BMI, sin base común)", () => {
    const rows = [{ planCode: "SIGMA_D150" }, { planCode: "SIGMA_D250" }, { planCode: "GMM_5K" }];
    const groups = groupHealthPlansByFamily(rows);
    expect(groups.map((g) => g.family)).toEqual(["SIGMA D150", "SIGMA D250", "GMM 5K"]);
  });

  it("código nulo cae en su propia familia '—' sin romper", () => {
    const rows = [{ planCode: null }, { planCode: "UNICO_7K" }];
    const groups = groupHealthPlansByFamily(rows);
    expect(groups.map((g) => g.family)).toEqual(["—", "UNICO 7K"]);
  });
});
