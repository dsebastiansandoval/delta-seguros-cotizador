import { describe, expect, it } from "vitest";
import { buildPatioTuercaUrl } from "./patiotuerca-link";

describe("buildPatioTuercaUrl", () => {
  it("arma la URL real confirmada navegando el sitio (Alfa Romeo Mito 2014)", () => {
    expect(buildPatioTuercaUrl("Alfa Romeo", "Mito", "2014")).toBe(
      "https://ecuador.patiotuerca.com/precio/autos/alfa+romeo/mito/2014",
    );
  });

  it("reemplaza puntos por + en el modelo (Corolla 1.2)", () => {
    expect(buildPatioTuercaUrl("Toyota", "Corolla 1.2", "2020")).toBe(
      "https://ecuador.patiotuerca.com/precio/autos/toyota/corolla+1+2/2020",
    );
  });

  it("colapsa espacios múltiples y mayúsculas (Corolla Cross)", () => {
    expect(buildPatioTuercaUrl("Toyota", "Corolla  Cross", "2023")).toBe(
      "https://ecuador.patiotuerca.com/precio/autos/toyota/corolla+cross/2023",
    );
  });

  it("null si falta marca, modelo o año", () => {
    expect(buildPatioTuercaUrl("", "Corolla", "2020")).toBeNull();
    expect(buildPatioTuercaUrl("Toyota", "", "2020")).toBeNull();
    expect(buildPatioTuercaUrl("Toyota", "Corolla", "")).toBeNull();
  });

  it("null si el año no son 4 dígitos", () => {
    expect(buildPatioTuercaUrl("Toyota", "Corolla", "20")).toBeNull();
    expect(buildPatioTuercaUrl("Toyota", "Corolla", "abcd")).toBeNull();
  });
});
