import { describe, expect, it } from "vitest";
import { addDays, csvMoney, installmentColumns, installmentUrgency, share, toCsv } from "./back-office";

describe("installmentUrgency", () => {
  const today = "2026-10-25";

  it("marca vencida la cuota con fecha pasada", () => {
    expect(installmentUrgency("2026-10-24", today)).toBe("VENCIDA");
  });

  it("marca por vencer hasta 15 días, incluido hoy", () => {
    expect(installmentUrgency(today, today)).toBe("POR_VENCER");
    expect(installmentUrgency(addDays(today, 15), today)).toBe("POR_VENCER");
    expect(installmentUrgency(addDays(today, 16), today)).toBeNull();
  });

  it("sin fecha no se clasifica", () => {
    expect(installmentUrgency(null, today)).toBeNull();
  });
});

describe("CSV de las bases", () => {
  it("usa ; y coma decimal, con BOM, y escapa celdas con ;", () => {
    const csv = toCsv(["A", "B"], [["PÉREZ; JUAN", csvMoney(123456)], [null, 5]]);
    expect(csv).toBe('﻿A;B\r\n"PÉREZ; JUAN";1234,56\r\n;5\r\n');
  });

  it("columnas 1..12 de BASE PENDIENTE", () => {
    const cols = installmentColumns([
      { number: 1, amountCents: 10000, isPaid: true },
      { number: 2, amountCents: 10050, isPaid: false },
      { number: 13, amountCents: 1, isPaid: false },
    ]);
    expect(cols).toHaveLength(12);
    expect(cols.slice(0, 3)).toEqual(["PAGADA", "100,50", ""]);
  });
});

it("share redondea y no divide por cero", () => {
  expect(share(1, 3)).toBe(33);
  expect(share(0, 0)).toBe(0);
});
