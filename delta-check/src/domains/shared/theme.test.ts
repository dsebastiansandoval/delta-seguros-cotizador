import { describe, expect, it } from "vitest";
import { nextTheme, parseThemeValue } from "./theme";

describe("parseThemeValue", () => {
  it("acepta light y dark tal cual", () => {
    expect(parseThemeValue("light")).toBe("light");
    expect(parseThemeValue("dark")).toBe("dark");
  });

  it("cualquier otro valor (o null) cae a system, nunca lanza", () => {
    expect(parseThemeValue(null)).toBe("system");
    expect(parseThemeValue("")).toBe("system");
    expect(parseThemeValue("azul")).toBe("system");
    expect(parseThemeValue("LIGHT")).toBe("system");
  });
});

describe("nextTheme", () => {
  it("cicla system → light → dark → system", () => {
    expect(nextTheme("system")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
  });
});
