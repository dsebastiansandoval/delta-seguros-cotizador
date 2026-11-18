import { describe, expect, it } from "vitest";
import { insurerLogo } from "./insurer-logos";

describe("insurerLogo", () => {
  it("resuelve el logo de todas las aseguradoras de Salud sembradas", () => {
    for (const code of ["BMI", "BUPA", "CONFIAMED", "HUMANA", "PRO", "SALUD", "SALUDSA", "VB"]) {
      const logo = insurerLogo(code);
      expect(logo, `logo de ${code}`).not.toBeNull();
      expect(logo!.src.length).toBeGreaterThan(0);
      expect(logo!.aspect).toBeGreaterThan(0);
    }
  });

  it("SALUD usa el mismo logo que SALUDSA (ambos hojas del Excel recortan image165.png)", () => {
    expect(insurerLogo("SALUD")).toEqual(insurerLogo("SALUDSA"));
  });

  it("cae al texto para códigos sin logo", () => {
    expect(insurerLogo("DESCONOCIDA")).toBeNull();
  });
});
