import { describe, expect, it } from "vitest";
import { newHealthQuoteSchema } from "./health-quote.schema";

const base = {
  documentType: "CEDULA",
  documentNumber: "1710000099",
  firstName: "",
  lastName: "",
  source: "",
  region: "SIERRA",
  titularBirthDate: "1993-01-01",
  titularGender: "MASCULINO",
  dep1BirthDate: "",
  dep1Gender: "",
  dep2BirthDate: "",
  dep2Gender: "",
  dep3BirthDate: "",
  dep3Gender: "",
};

describe("newHealthQuoteSchema", () => {
  it("calcula la edad del titular a partir de la fecha de nacimiento", () => {
    const result = newHealthQuoteSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.titularAge).toBeGreaterThan(0);
    }
  });

  it("un dependiente vacío queda undefined, no edad 0 (mismo bug que client.schema)", () => {
    const result = newHealthQuoteSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dep1Age).toBeUndefined();
    }
  });

  it("acepta un dependiente real con edad 0 (bebé) sin confundirlo con vacío", () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = newHealthQuoteSchema.safeParse({ ...base, dep1BirthDate: today, dep1Gender: "FEMENINO" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dep1Age).toBe(0);
    }
  });
});
