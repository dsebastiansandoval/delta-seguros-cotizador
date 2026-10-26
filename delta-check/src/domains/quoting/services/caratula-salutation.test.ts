import { describe, expect, it } from "vitest";
import { salutationFor } from "./caratula-salutation";

describe("salutationFor (CARATULA!C7)", () => {
  it("NATURAL + MASCULINO → Señor", () => {
    expect(salutationFor({ personType: "NATURAL", gender: "MASCULINO", maritalStatus: "CASADO" })).toBe("Señor");
  });

  it("JURIDICA → Señores, sin importar género/estado civil", () => {
    expect(salutationFor({ personType: "JURIDICA", gender: null, maritalStatus: null })).toBe("Señores");
  });

  it("NATURAL + FEMENINO + SOLTERO → Señorita", () => {
    expect(salutationFor({ personType: "NATURAL", gender: "FEMENINO", maritalStatus: "SOLTERO" })).toBe("Señorita");
  });

  it("NATURAL + FEMENINO + CASADO → Señora", () => {
    expect(salutationFor({ personType: "NATURAL", gender: "FEMENINO", maritalStatus: "CASADO" })).toBe("Señora");
  });

  it("NATURAL sin género (dato faltante) cae en Señora, igual que el Excel", () => {
    expect(salutationFor({ personType: "NATURAL", gender: null, maritalStatus: null })).toBe("Señora");
  });
});
