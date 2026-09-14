import { describe, expect, it } from "vitest";
import { cedulaToNaturalPersonRuc, ECUADOR_PROVINCES, isValidCedula, provinceFromCedula } from "./cedula.validator";

describe("isValidCedula", () => {
  it("acepta una cédula con dígito verificador correcto (algoritmo módulo 10)", () => {
    expect(isValidCedula("1701234567")).toBe(true);
  });

  it("rechaza un dígito verificador incorrecto", () => {
    expect(isValidCedula("1701234568")).toBe(false);
  });

  it("rechaza longitud distinta de 10", () => {
    expect(isValidCedula("170123456")).toBe(false);
    expect(isValidCedula("17012345678")).toBe(false);
  });

  it("rechaza caracteres no numéricos", () => {
    expect(isValidCedula("17A1234567")).toBe(false);
  });

  it("rechaza código de provincia fuera de 01-24", () => {
    expect(isValidCedula("9901234560")).toBe(false);
  });

  it("rechaza tercer dígito >6 (RUC de sociedad, no cédula de persona natural)", () => {
    expect(isValidCedula("1790012345")).toBe(false); // SRI mismo, tercer dígito 9
  });
});

describe("cedulaToNaturalPersonRuc", () => {
  it("agrega el sufijo 001", () => {
    expect(cedulaToNaturalPersonRuc("1701234567")).toBe("1701234567001");
  });
});

describe("provinceFromCedula", () => {
  it("resuelve el código real de provincia (17 = Pichincha)", () => {
    expect(provinceFromCedula("1701234567")).toBe("Pichincha");
  });

  it("resuelve otro código real (09 = Guayas)", () => {
    expect(provinceFromCedula("0901234567")).toBe("Guayas");
  });

  it("null si no son 10 dígitos", () => {
    expect(provinceFromCedula("170123456")).toBeNull();
  });

  it("null si el código no mapea a ninguna provincia", () => {
    expect(provinceFromCedula("9901234567")).toBeNull();
  });
});

describe("ECUADOR_PROVINCES", () => {
  it("trae las 24 provincias reales, sin duplicados", () => {
    expect(ECUADOR_PROVINCES).toHaveLength(24);
    expect(new Set(ECUADOR_PROVINCES).size).toBe(24);
  });

  it("incluye provincias reales conocidas", () => {
    expect(ECUADOR_PROVINCES).toContain("Pichincha");
    expect(ECUADOR_PROVINCES).toContain("Guayas");
    expect(ECUADOR_PROVINCES).toContain("Galápagos");
  });

  it("está ordenada alfabéticamente", () => {
    const sorted = [...ECUADOR_PROVINCES].sort((a, b) => a.localeCompare(b, "es"));
    expect(ECUADOR_PROVINCES).toEqual(sorted);
  });
});
