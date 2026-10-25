import { describe, expect, it } from "vitest";
import { buildAgentReport, parseReportMonth, recentMonths } from "./agent-report";

const now = new Date(2026, 9, 25); // 25 oct 2026

describe("parseReportMonth", () => {
  it("lee mes=YYYY-MM y arma el rango [inicio, inicio del mes siguiente)", () => {
    const month = parseReportMonth("2026-12", now);
    expect(month.label).toBe("Diciembre 2026");
    expect(month.start).toEqual(new Date(2026, 11, 1));
    expect(month.end).toEqual(new Date(2027, 0, 1));
  });

  it("usa el mes en curso si el parámetro falta o es inválido", () => {
    expect(parseReportMonth(undefined, now).value).toBe("2026-10");
    expect(parseReportMonth("2026-13", now).value).toBe("2026-10");
  });
});

describe("recentMonths", () => {
  it("cruza el cambio de año hacia atrás", () => {
    expect(recentMonths(12, now).map((m) => m.value).slice(9)).toEqual(["2026-01", "2025-12", "2025-11"]);
  });
});

describe("buildAgentReport", () => {
  const names = new Map([
    ["a", "Ana"],
    ["b", "Beto"],
  ]);

  it("cruza cotizado con emitido por ejecutivo, ordena por cotizaciones y totaliza", () => {
    const report = buildAgentReport(
      [
        { agentId: "a", quotes: 2, risks: 3 },
        { agentId: "b", quotes: 4, risks: 4 },
      ],
      // Ana: 1 de sus 2 cotizaciones terminó en 2 pólizas (2 vehículos).
      [{ agentId: "a", convertedQuotes: 1, policies: 2, premiumCents: 150000 }],
      names,
    );
    expect(report.rows.map((r) => r.agentName)).toEqual(["Beto", "Ana"]);
    expect(report.rows[1]).toMatchObject({ policies: 2, conversionRate: 0.5, premiumCents: 150000 });
    expect(report.rows[0]).toMatchObject({ policies: 0, conversionRate: 0, premiumCents: 0 });
    expect(report.totals).toEqual({ quotes: 6, risks: 7, policies: 2, conversionRate: 1 / 6, premiumCents: 150000 });
  });
});
