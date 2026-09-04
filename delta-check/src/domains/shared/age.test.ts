import { describe, expect, it } from "vitest";
import { calculateAge } from "./age";

describe("calculateAge", () => {
  it("resta los años cuando ya pasó el cumpleaños este año", () => {
    expect(calculateAge("1990-03-01", new Date("2026-09-01T00:00:00Z"))).toBe(36);
  });

  it("resta un año extra cuando todavía no llega el cumpleaños este año", () => {
    expect(calculateAge("1990-12-25", new Date("2026-09-01T00:00:00Z"))).toBe(35);
  });

  it("el día exacto del cumpleaños ya cuenta la edad nueva", () => {
    expect(calculateAge("1990-09-01", new Date("2026-09-01T00:00:00Z"))).toBe(36);
  });

  it("el día antes del cumpleaños todavía no cuenta la edad nueva", () => {
    expect(calculateAge("1990-09-02", new Date("2026-09-01T00:00:00Z"))).toBe(35);
  });

  it("recién nacido da 0", () => {
    expect(calculateAge("2026-08-15", new Date("2026-09-01T00:00:00Z"))).toBe(0);
  });
});
