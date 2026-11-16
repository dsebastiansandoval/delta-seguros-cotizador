import { describe, expect, it } from "vitest";
import { inferGenderFromName } from "./gender-from-name";

describe("inferGenderFromName", () => {
  it("reconoce nombres femeninos comunes de la lista", () => {
    expect(inferGenderFromName("Maria")).toBe("FEMENINO");
    expect(inferGenderFromName("Carmen")).toBe("FEMENINO");
    expect(inferGenderFromName("Rosario")).toBe("FEMENINO");
  });

  it("reconoce nombres masculinos comunes de la lista", () => {
    expect(inferGenderFromName("Jose")).toBe("MASCULINO");
    expect(inferGenderFromName("Carlos")).toBe("MASCULINO");
    expect(inferGenderFromName("Joel")).toBe("MASCULINO");
  });

  it("usa solo la primera palabra en nombres compuestos", () => {
    expect(inferGenderFromName("Juan Carlos")).toBe("MASCULINO");
    expect(inferGenderFromName("Maria Fernanda")).toBe("FEMENINO");
    expect(inferGenderFromName("Jose Maria")).toBe("MASCULINO");
  });

  it("ignora acentos y mayúsculas", () => {
    expect(inferGenderFromName("MÓNICA")).toBe("FEMENINO");
    expect(inferGenderFromName("ándres")).toBe("MASCULINO");
  });

  it("cae a la heurística de terminación -a/-o para nombres fuera de la lista", () => {
    expect(inferGenderFromName("Fulanita")).toBe("FEMENINO");
    expect(inferGenderFromName("Fulanito")).toBe("MASCULINO");
  });

  it("respeta las excepciones a la terminación -a", () => {
    expect(inferGenderFromName("Joshua")).toBe("MASCULINO");
  });

  it("no adivina nombres ambiguos o desconocidos sin terminación clara", () => {
    expect(inferGenderFromName("Yamil")).toBeNull();
    expect(inferGenderFromName("")).toBeNull();
    expect(inferGenderFromName("   ")).toBeNull();
  });
});
