import { describe, expect, it } from "vitest";
import { isAllowedMicrosoftEmail } from "./microsoft-domain";

describe("isAllowedMicrosoftEmail", () => {
  it("acepta una cuenta real de Delta Seguros", () => {
    expect(isAllowedMicrosoftEmail("agente@deltaseguros.com.ec")).toBe(true);
  });

  it("no distingue mayúsculas/minúsculas (Microsoft normaliza el email distinto según el tenant)", () => {
    expect(isAllowedMicrosoftEmail("Agente@DeltaSeguros.Com.Ec")).toBe(true);
  });

  it("rechaza otro dominio", () => {
    expect(isAllowedMicrosoftEmail("agente@gmail.com")).toBe(false);
  });

  it("rechaza un dominio parecido que no es exactamente el mismo", () => {
    expect(isAllowedMicrosoftEmail("agente@notdeltaseguros.com.ec")).toBe(false);
    expect(isAllowedMicrosoftEmail("agente@deltaseguros.com.ec.evil.com")).toBe(false);
  });

  it("rechaza null/undefined/vacío sin lanzar", () => {
    expect(isAllowedMicrosoftEmail(null)).toBe(false);
    expect(isAllowedMicrosoftEmail(undefined)).toBe(false);
    expect(isAllowedMicrosoftEmail("")).toBe(false);
  });
});
