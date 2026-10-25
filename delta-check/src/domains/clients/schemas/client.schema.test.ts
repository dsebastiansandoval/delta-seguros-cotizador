import { describe, expect, it } from "vitest";
import { newAutoQuoteSchema } from "./client.schema";

const base = {
  personType: "NATURAL",
  documentType: "CEDULA",
  documentNumber: "1710034065",
  plate1: "PBA-1234",
  brand1: "TOYOTA",
  model1: "COROLLA",
  year1: "2022",
  commercialValueDollars1: "20000",
};

describe("newAutoQuoteSchema — datos de DATOS VH", () => {
  it("calcula el fin de vigencia como inicio + 1 año si no viene (DATOS VH!H20)", () => {
    const parsed = newAutoQuoteSchema.parse({ ...base, operationType: "RENOVACION", previousStartDate: "2025-11-03" });
    expect(parsed.previousExpiryDate).toBe("2026-11-03");
  });

  it("guarda nacimiento, estado civil y género solo para persona natural", () => {
    const personal = { birthDate: "1990-05-20", maritalStatus: "CASADO", gender: "FEMENINO" };
    const natural = newAutoQuoteSchema.parse({ ...base, ...personal });
    expect(natural).toMatchObject(personal);

    const juridica = newAutoQuoteSchema.parse({ ...base, ...personal, personType: "JURIDICA", documentType: "RUC" });
    expect(juridica.birthDate).toBeUndefined();
    expect(juridica.gender).toBeUndefined();
  });

  it("rechaza una fecha de nacimiento futura", () => {
    expect(newAutoQuoteSchema.safeParse({ ...base, birthDate: "2999-01-01" }).success).toBe(false);
  });
});
