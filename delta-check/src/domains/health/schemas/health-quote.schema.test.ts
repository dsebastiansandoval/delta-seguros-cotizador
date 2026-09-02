import { describe, expect, it } from "vitest";
import { newHealthQuoteSchema } from "./health-quote.schema";

const base = {
  personType: "NATURAL",
  documentType: "CEDULA",
  documentNumber: "1710000099",
  firstName: "",
  lastName: "",
  source: "",
  region: "SIERRA",
  titularAge: "33",
  titularGender: "MASCULINO",
  dep1Age: "",
  dep1Gender: "",
  dep2Age: "",
  dep2Gender: "",
  dep3Age: "",
  dep3Gender: "",
};

describe("newHealthQuoteSchema", () => {
  it("un dependiente vacío queda undefined, no edad 0 (mismo bug que client.schema)", () => {
    const result = newHealthQuoteSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dep1Age).toBeUndefined();
    }
  });

  it("acepta un dependiente real con edad 0 (bebé) sin confundirlo con vacío", () => {
    const result = newHealthQuoteSchema.safeParse({ ...base, dep1Age: "0", dep1Gender: "FEMENINO" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dep1Age).toBe(0);
    }
  });
});
