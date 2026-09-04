import { describe, expect, it } from "vitest";
import { splitRazonSocial } from "./razon-social.parser";

describe("splitRazonSocial", () => {
  it("2 apellidos + 2 nombres (caso típico)", () => {
    expect(splitRazonSocial("MENDEZ TORRES JUAN CARLOS")).toEqual({
      lastName: "MENDEZ TORRES",
      firstName: "JUAN CARLOS",
    });
  });

  it("2 apellidos + 1 nombre", () => {
    expect(splitRazonSocial("MENDEZ TORRES JUAN")).toEqual({
      lastName: "MENDEZ TORRES",
      firstName: "JUAN",
    });
  });

  it("solo 2 palabras — deja 1 para el nombre en vez de 2 apellidos sin nombre", () => {
    expect(splitRazonSocial("MENDEZ JUAN")).toEqual({ lastName: "MENDEZ", firstName: "JUAN" });
  });

  it("una sola palabra — todo va a nombre, sin apellido", () => {
    expect(splitRazonSocial("MENDEZ")).toEqual({ lastName: "", firstName: "MENDEZ" });
  });

  it("cadena vacía", () => {
    expect(splitRazonSocial("")).toEqual({ lastName: "", firstName: "" });
  });

  it("colapsa espacios múltiples", () => {
    expect(splitRazonSocial("MENDEZ   TORRES  JUAN")).toEqual({
      lastName: "MENDEZ TORRES",
      firstName: "JUAN",
    });
  });
});
