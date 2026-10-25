import { describe, expect, it } from "vitest";
import { editableClientUpdates } from "./client-updates";

const base = {
  organizationId: "org",
  personType: "NATURAL" as const,
  documentType: "CEDULA" as const,
  documentNumber: "1710034065",
};

describe("editableClientUpdates (cliente que vuelve a cotizar)", () => {
  it("toma los nombres y contacto corregidos por el ejecutivo", () => {
    expect(editableClientUpdates({ ...base, firstName: "María José", lastName: "Paredes", phone: "0991234567" })).toEqual({
      firstName: "María José",
      lastName: "Paredes",
      phone: "0991234567",
    });
  });

  it("no borra lo que quedó en blanco ni toca documento, fuente o ejecutivo", () => {
    expect(editableClientUpdates({ ...base, firstName: "", email: undefined, source: "REFERIDO", executive: "X" })).toEqual({});
  });
});
