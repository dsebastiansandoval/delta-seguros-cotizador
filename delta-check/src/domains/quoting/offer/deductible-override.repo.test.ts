import "@/db/schema"; // fuerza el orden de carga seguro del barrel antes de tocar catalog.ts directo (ver _helpers.ts <-> organizations.ts)
import { describe, expect, it } from "vitest";
import { applyDeductibleOverride, loadDeductibleOverrides } from "./deductible-override.repo";
import { INSURER_OFFER_PROFILES } from "./insurer-offer-profiles";

const aig = INSURER_OFFER_PROFILES.AIG;

describe("applyDeductibleOverride", () => {
  it("sin override, devuelve el perfil hardcodeado sin tocarlo", () => {
    expect(applyDeductibleOverride(aig, undefined)).toBe(aig);
  });

  it("con override, pisa solo defaults/options de deducible — el resto del perfil queda igual", () => {
    const merged = applyDeductibleOverride(aig, {
      insurerId: "ins-1",
      partialDefault: "* Nuevo deducible parcial",
      totalLossDefault: "* Nueva pérdida total",
      partialOptions: ["* Nuevo deducible parcial", "* Otra opción"],
      partialParts: null,
      totalLossOptions: ["* Nueva pérdida total"],
    });
    expect(merged?.defaults.partialDeductible).toBe("* Nuevo deducible parcial");
    expect(merged?.defaults.totalLossDeductible).toBe("* Nueva pérdida total");
    expect(merged?.options.partialDeductible).toEqual(["* Nuevo deducible parcial", "* Otra opción"]);
    expect(merged?.options.totalLossDeductible).toEqual(["* Nueva pérdida total"]);
    // No tocado — sigue siendo el valor del Excel.
    expect(merged?.defaults.rcAmount).toBe(aig.defaults.rcAmount);
    expect(merged?.rows).toBe(aig.rows);
  });

  it("override con partialParts manda sobre partialOptions", () => {
    const merged = applyDeductibleOverride(aig, {
      insurerId: "ins-1",
      partialDefault: "combinado",
      totalLossDefault: "* x",
      partialOptions: [],
      partialParts: { vs: ["10% VS, "], va: ["1% VA, "], min: ["mínimo 200"] },
      totalLossOptions: ["* x"],
    });
    expect(merged?.options.partialDeductibleParts).toEqual({ vs: ["10% VS, "], va: ["1% VA, "], min: ["mínimo 200"] });
    expect(merged?.options.partialDeductible).toBeUndefined();
  });

  it("perfil null (aseguradora desconocida) se devuelve tal cual, nunca lanza", () => {
    expect(applyDeductibleOverride(null, undefined)).toBeNull();
  });
});

describe("loadDeductibleOverrides", () => {
  it("si la consulta falla (ej. tabla sin migrar todavía), cae a mapa vacío en vez de romper la oferta", async () => {
    const brokenTx = {
      select: () => ({
        from: () => Promise.reject(new Error('relation "insurer_deductible_profiles" does not exist')),
      }),
    } as never;
    const overrides = await loadDeductibleOverrides(brokenTx);
    expect(overrides.size).toBe(0);
  });
});
