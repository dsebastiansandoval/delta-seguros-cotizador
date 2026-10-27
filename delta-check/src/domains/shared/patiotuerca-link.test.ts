import { describe, expect, it } from "vitest";
import { buildPatioTuercaLink } from "./patiotuerca-link";

const BASE = "https://ecuador.patiotuerca.com/precio/";
const url = (brand: string, model: string, year: string, known: string[] = []) => {
  const link = buildPatioTuercaLink(brand, model, year, known);
  return link && "url" in link ? link.url.replace(BASE, "") : link?.kind;
};

// Slugs verificados contra el catálogo real (patiotuerca-index.generated.ts) y las páginas con "Precio ideal".
describe("buildPatioTuercaLink — mismo modelo, escrito distinto", () => {
  it("separa letras y números cuando PatioTuerca lo hace (caso reportado: CX de Mazda)", () => {
    expect(url("MAZDA", "CX5", "2020")).toBe("autos/mazda/cx+5/2020");
    expect(url("MAZDA", "CX30", "2021")).toBe("autos/mazda/cx+30/2021");
    expect(url("MAZDA", "BT50", "2019")).toBe("autos/mazda/bt+50/2019");
    expect(url("TOYOTA", "RAV4", "2020")).toBe("autos/toyota/rav+4/2020");
  });

  it("no separa cuando PatioTuerca los escribe pegados (BMW X3, Audi Q5)", () => {
    expect(url("BMW", "X3", "2020")).toBe("autos/bmw/x3/2020");
    expect(url("AUDI", "Q5", "2020")).toBe("autos/audi/q5/2020");
  });

  it("siglas que PatioTuerca parte o junta distinto (CHR, TCROSS, WRV, TRAIL BLAZER)", () => {
    expect(url("TOYOTA", "CHR", "2020")).toBe("autos/toyota/c+hr/2020");
    expect(url("VOLKSWAGEN", "TCROSS", "2022")).toBe("autos/volkswagen/t+cross/2022");
    expect(url("HONDA", "WRV", "2022")).toBe("autos/honda/wr+v/2022");
    expect(url("NISSAN", "X TRAIL", "2020")).toBe("autos/nissan/x+trail/2020");
    expect(url("CHEVROLET", "TRAIL BLAZER", "2020")).toBe("autos/chevrolet/trailblazer/2020");
  });

  it("modelos de solo números (Peugeot 2008/3008, Mazda 3)", () => {
    expect(url("PEUGEOT", "3008", "2020")).toBe("autos/peugeot/3008/2020");
    expect(url("MAZDA", "MAZDA3", "2018")).toBe("autos/mazda/3/2018");
  });

  it("quita tildes y NEW/NUEVO (RÍO, SANTA FÉ, CITROËN, NUEVA CAPTIVA)", () => {
    expect(url("KIA", "RÍO", "2020")).toMatch(/^autos\/kia\/rio/);
    expect(url("HYUNDAI", "SANTA FÉ", "2018")).toBe("autos/hyundai/santa+fe/2018");
    expect(url("MAZDA", "NEW CX5", "2022")).toBe("autos/mazda/cx+5/2022");
    expect(url("CITROËN", "JUMPER", "2020")).toMatch(/^autos\/citroen\/jumper/);
    expect(url("CHEVROLET", "NUEVA CAPTIVA", "2022")).toBe("autos/chevrolet/captiva/2022");
  });

  it("el modelo exacto gana a una versión aunque PatioTuerca no liste el año (Golf, no Golf GTI)", () => {
    const golf = buildPatioTuercaLink("VOLKSWAGEN", "GOLF", "2020");
    expect(golf).toMatchObject({ kind: "MODEL", url: `${BASE}autos/volkswagen/golf/2020`, exact: true, yearListed: false });
    expect(golf?.kind === "MODEL" && golf.nearestYears.length).toBeGreaterThan(0);
  });
});

describe("buildPatioTuercaLink — versiones", () => {
  it("el texto trae la versión: va al modelo base (CX30 2.5L AT, FORTUNER 2G, ficha del Peugeot 301)", () => {
    expect(url("MAZDA", "CX30 2.5L AT", "2021")).toBe("autos/mazda/cx+30/2021");
    expect(url("TOYOTA", "HILUX 8G", "2020")).toBe("autos/toyota/hilux/2020");
    expect(url("PEUGEOT", "301 ALL 1.6E B5 AC 1.6 4P 4X2 TM", "2020", ["301"])).toBe("autos/peugeot/301/2020");
  });

  it("PatioTuerca solo tiene versiones: abre la más publicada con precio ese año (Corolla, GLC)", () => {
    const corolla = buildPatioTuercaLink("TOYOTA", "COROLLA", "2020", ["COROLLA", "COROLLA CROSS"]);
    expect(corolla).toMatchObject({ kind: "MODEL", exact: false, yearListed: true });
    expect(corolla?.kind === "MODEL" && corolla.url).toMatch(/\/toyota\/corolla\+(?!cross)/);
    expect(url("MERCEDES BENZ", "GLC", "2020")).toMatch(/^autos\/mercedes\+benz\/glc\+/);
  });

  it("no mezcla modelos que empiezan igual (COROLLA ≠ Corolla Cross, TIGGO ≠ Tiggo 2)", () => {
    expect(url("TOYOTA", "COROLLA", "2022", ["COROLLA", "COROLLA CROSS"])).not.toMatch(/cross/);
    expect(url("CHERY", "TIGGO", "2022", ["TIGGO", "TIGGO2"])).not.toMatch(/tiggo\+2/);
  });

  it("un número pegado al nombre es otro modelo: WINGLE no abre WINGLE5, WINGLE5 sí abre Wingle 5", () => {
    expect(url("GREAT WALL (GWM)", "WINGLE5", "2020")).toMatch(/^autos\/great\+wall\/wingle\+5/);
    expect(url("GREAT WALL (GWM)", "WINGLE7", "2020")).toMatch(/^autos\/great\+wall\/wingle\+7/);
  });

  it("camiones van a la guía de pesados (Chevrolet FVR)", () => {
    expect(url("CHEVROLET", "FVR", "2024")).toBe("pesados/chevrolet/fvr/2024");
  });
});

describe("buildPatioTuercaLink — sin página", () => {
  it("modelo que PatioTuerca no tiene: abre la lista de la marca", () => {
    expect(url("KIA", "MOHAVE", "2020")).toBe("autos/kia");
    expect(url("GREAT WALL (GWM)", "WINGLE3", "2020")).toBe("autos/great+wall");
  });

  it("marca sin precios en PatioTuerca", () => {
    expect(url("JAECOO", "J7", "2025")).toBe("UNAVAILABLE");
  });

  it("marca fuera del catálogo y de PatioTuerca: arma la URL directo", () => {
    expect(url("Marca Rara", "Modelo X", "2020")).toBe("autos/marca+rara/modelo+x/2020");
  });

  it("null si falta marca, modelo o un año de 4 dígitos", () => {
    expect(buildPatioTuercaLink("", "Corolla", "2020")).toBeNull();
    expect(buildPatioTuercaLink("TOYOTA", "", "2020")).toBeNull();
    expect(buildPatioTuercaLink("TOYOTA", "Corolla", "")).toBeNull();
    expect(buildPatioTuercaLink("TOYOTA", "Corolla", "20")).toBeNull();
  });
});
