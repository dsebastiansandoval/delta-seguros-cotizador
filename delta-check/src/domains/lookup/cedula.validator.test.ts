import { describe, expect, it } from "vitest";
import { cedulaToNaturalPersonRuc, isValidCedula } from "./cedula.validator";

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
