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

  it("usa el código base del catálogo cuando el modelo trae la ficha técnica completa (caso real reportado: Peugeot 301)", () => {
    expect(
      buildPatioTuercaUrl("Peugeot", "301 ALL 1.6E B5 AC 1.6 4P 4X2 TM", "2020", ["301"]),
    ).toBe("https://ecuador.patiotuerca.com/precio/autos/peugeot/301/2020");
  });

  it("prefiere el match más largo del catálogo (CX30 no se recorta a CX3)", () => {
    expect(buildPatioTuercaUrl("Mazda", "CX30 2.5L AT", "2020", ["CX3", "CX30"])).toBe(
      "https://ecuador.patiotuerca.com/precio/autos/mazda/cx30/2020",
    );
  });

  it("sin match en el catálogo, usa el texto tal cual (comportamiento de siempre)", () => {
    expect(buildPatioTuercaUrl("Mazda", "CX30 2.5L AT", "2020", ["CX5"])).toBe(
      "https://ecuador.patiotuerca.com/precio/autos/mazda/cx30+2+5l+at/2020",
    );
  });
});
