import { describe, expect, it } from "vitest";
import { blankHealthRateCsv, healthRatesToCsv, parseHealthRateCsv, parseMoneyCents } from "./health-rate-csv";

const options = { validPlanCodes: ["SIGMA_D150", "SIGMA_D250"] };

describe("parseMoneyCents", () => {
  it("acepta punto o coma decimal y separador de miles", () => {
    expect(parseMoneyCents("2235.96")).toBe(223596);
    expect(parseMoneyCents("2235,96")).toBe(223596);
    expect(parseMoneyCents("2.235,96")).toBe(223596);
    expect(parseMoneyCents("$2,235.96")).toBe(223596);
    expect(parseMoneyCents("abc")).toBeNull();
    expect(parseMoneyCents("")).toBeNull();
  });
});

describe("parseHealthRateCsv", () => {
  it("lee el formato de Excel en español (; y coma decimal, BOM)", () => {
    const csv = "﻿plan;relacion;edad_desde;edad_hasta;sexo;region;prima\r\nsigma_d150;TITULAR;18;18;;COSTA;2235,96\r\nSIGMA_D150;dependiente;0;17;F;;100\r\n";
    const result = parseHealthRateCsv(csv, options);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { planCode: "SIGMA_D150", relation: "TITULAR", ageMin: 18, ageMax: 18, gender: null, region: "COSTA", premiumCents: 223596 },
      { planCode: "SIGMA_D150", relation: "DEPENDIENTE", ageMin: 0, ageMax: 17, gender: "FEMENINO", region: null, premiumCents: 10000 },
    ]);
  });

  it("reporta las filas inválidas con su número de fila y no devuelve filas", () => {
    const csv = "plan,relacion,edad_desde,edad_hasta,sexo,region,prima\nSIGMA_D150,TITULAR,18,18,,COSTA,10\nOTRO,HIJO,30,20,X,LOJA,0\n";
    const result = parseHealthRateCsv(csv, options);
    expect(result.rows).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/^Fila 3: plan "OTRO".*relación "HIJO".*sexo "X".*región "LOJA".*mayor.*prima "0"/);
  });

  it("detecta rangos de edad superpuestos para la misma combinación", () => {
    const csv = "plan,relacion,edad_desde,edad_hasta,sexo,region,prima\nSIGMA_D150,TITULAR,18,30,,COSTA,10\nSIGMA_D150,TITULAR,30,40,,COSTA,10\nSIGMA_D150,TITULAR,30,40,,SIERRA,10\n";
    const result = parseHealthRateCsv(csv, options);
    expect(result.errors).toEqual(["SIGMA_D150 TITULAR COSTA: las edades 18-30 y 30-40 se superponen"]);
  });

  it("avisa los planes vigentes que no vienen en el archivo", () => {
    const csv = "plan,relacion,edad_desde,edad_hasta,sexo,region,prima\nSIGMA_D150,,0,99,,,10\n";
    const result = parseHealthRateCsv(csv, { ...options, currentPlanCodes: ["SIGMA_D150", "SIGMA_D250"] });
    expect(result.missingPlans).toEqual(["SIGMA_D250"]);
  });

  it("exige todas las columnas", () => {
    expect(parseHealthRateCsv("plan,prima\nSIGMA_D150,10", options).errors[0]).toMatch(/Faltan columnas: relacion/);
  });

  it("lo que exporta healthRatesToCsv se vuelve a leer igual", () => {
    const rows = [
      { planCode: "SIGMA_D250", relation: null, ageMin: 0, ageMax: 99, gender: "MASCULINO", region: "AUSTRO", premiumCents: 123456 },
    ] as const;
    expect(parseHealthRateCsv(healthRatesToCsv([...rows]), options).rows).toEqual(rows);
  });
});

describe("blankHealthRateCsv", () => {
  it("una fila por plan, con el código puesto y el resto vacío", () => {
    const csv = blankHealthRateCsv(["SIGMA_D150", "SIGMA_D250"]);
    expect(csv).toBe("﻿plan,relacion,edad_desde,edad_hasta,sexo,region,prima\r\nSIGMA_D150,,,,,,\r\nSIGMA_D250,,,,,,\r\n");
  });

  it("sin plan_code, es solo el encabezado", () => {
    expect(blankHealthRateCsv([])).toBe("﻿plan,relacion,edad_desde,edad_hasta,sexo,region,prima\r\n");
  });
});
