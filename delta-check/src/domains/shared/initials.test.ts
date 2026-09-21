import { describe, expect, it } from "vitest";
import { initialsFrom } from "./initials";

describe("initialsFrom", () => {
  it("primera letra del primer y último nombre", () => {
    expect(initialsFrom("Richard Escobar", "richard@deltaseguros.com.ec")).toBe("RE");
  });

  it("con varios nombres intermedios, ignora los del medio", () => {
    expect(initialsFrom("Ana María Torres Vivanco", "ana@deltaseguros.com.ec")).toBe("AV");
  });

  it("un solo nombre — primeras 2 letras", () => {
    expect(initialsFrom("Cher", "cher@deltaseguros.com.ec")).toBe("CH");
  });

  it("sin nombre, cae al correo", () => {
    expect(initialsFrom(null, "dev@deltaseguros.local")).toBe("DE");
  });

  it("nombre vacío/solo espacios, cae al correo", () => {
    expect(initialsFrom("   ", "agente@deltaseguros.com.ec")).toBe("AG");
  });
});
