/**
 * Lógica pura del back-office (sin DB, testeable con vitest): clasificar
 * cuotas por vencimiento y armar los CSV que reemplazan las 5 hojas BASE
 * del Excel (EXCEL-AUDIT.md §4).
 */

/** Cuotas que vencen dentro de esta ventana aparecen como "por vencer". */
export const DUE_SOON_DAYS = 15;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Días entre dos fechas "YYYY-MM-DD" (b − a). */
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export type InstallmentUrgency = "VENCIDA" | "POR_VENCER";

/** Una cuota impaga sin fecha no se puede clasificar — no se muestra en la cola. */
export function installmentUrgency(dueDate: string | null, today: string): InstallmentUrgency | null {
  if (!dueDate) return null;
  const days = daysBetween(today, dueDate);
  if (days < 0) return "VENCIDA";
  if (days <= DUE_SOON_DAYS) return "POR_VENCER";
  return null;
}

export function clientDisplayName(c: {
  clientFirstName: string | null;
  clientLastName: string | null;
  clientBusinessName: string | null;
}) {
  return c.clientBusinessName || `${c.clientFirstName ?? ""} ${c.clientLastName ?? ""}`.trim() || "—";
}

/** Porcentaje entero de `part` sobre `total`, 0 si no hay total. */
export function share(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

// ---- CSV de las hojas BASE ----

/**
 * `;` y coma decimal: así lo abre directo un Excel en español (Ecuador), sin
 * pasar por "Texto en columnas". BOM para que respete las tildes.
 */
export type CsvValue = string | number | null | undefined;

export function csvCell(value: CsvValue) {
  if (value == null) return "";
  const text = String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Centavos → "1234,56" (sin separador de miles, para que Excel lo lea como número). */
export function csvMoney(cents: number | null | undefined) {
  return cents == null ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

export function toCsv(header: readonly string[], rows: CsvValue[][]) {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export const BACK_OFFICE_BASES = ["emisiones", "pendiente", "comisiones", "canceladas", "siniestros"] as const;
export type BackOfficeBase = (typeof BACK_OFFICE_BASES)[number];

/** Columnas reales de cada ListObject del Excel (EXCEL-AUDIT.md §4), en el mismo orden. */
export const BASE_HEADERS: Record<BackOfficeBase, readonly string[]> = {
  emisiones: [
    "REFERENCIA", "FECHA EMISION", "DOCUMENTO", "FUENTE", "C.I.", "NOMBRES", "APELLIDOS", "RAMO",
    "ASEGURADORA", "POLIZA", "ANEXO", "ESTATUS", "PRIMA", "DOC", "OBSERVACIONES",
  ],
  pendiente: [
    "REFERENCIA", "FECHA EMISION", "DOCUMENTO", "FUENTE", "C.I.", "NOMBRES", "APELLIDOS", "RAMO", "CIA",
    "ASEGURADORA", "ESTATUS", "FORMA DE PAGO", "CUOTAS", "POLIZA", "ANEXO", "FACTURA", "PRIMA",
    "SUPER BCOS", "SC", "DERECHOS EMISION", "IVA", "TOTAL", "VALOR CUOTA", "VALOR PENDIENTE",
    "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "OBSERVACIONES",
  ],
  // COMISION (monto) no está en el Excel — se agrega al lado del %, que es de donde sale.
  comisiones: [
    "REFERENCIA", "FECHA EMISION", "DOCUMENTO", "FUENTE", "C.I.", "NOMBRES", "APELLIDOS", "POLIZA",
    "RAMO", "CIA", "ASEGURADORA", "CARTERA", "PRIMA", "% COMISION", "COMISION", "ESTATUS", "OBSERVACIONES",
  ],
  canceladas: [
    "FECHA CANCELACION", "C.I.", "NOMBRES", "APELLIDOS", "FUENTE", "ASEGURADORA", "RAMO", "POLIZA",
    "PRIMA", "ESTATUS", "COMISION", "OBSERVACIONES",
  ],
  siniestros: [
    "FECHA SINIESTRO", "FECHA REPORTE", "C.I.", "NOMBRES", "APELLIDOS", "RAMO", "ASEGURADORA", "POLIZA",
    "TALLER", "ASESOR", "CONTACTO", "PLACA", "MARCA", "MODELO", "RC", "PLACA RC", "ESTATUS", "VALOR",
    "VALOR RC", "OBSERVACIONES",
  ],
};

export const BASE_LABELS: Record<BackOfficeBase, string> = {
  emisiones: "Base emisiones",
  pendiente: "Base pendiente (cuotas)",
  comisiones: "Base comisiones",
  canceladas: "Base canceladas",
  siniestros: "Base siniestros",
};

/** Columnas 1..12 de BASE PENDIENTE: valor de la cuota si está impaga, "PAGADA" si no. Más de 12 no entra. */
export function installmentColumns(installments: Array<{ number: number; amountCents: number; isPaid: boolean }>) {
  const columns: CsvValue[] = Array(12).fill("");
  for (const i of installments) {
    if (i.number >= 1 && i.number <= 12) columns[i.number - 1] = i.isPaid ? "PAGADA" : csvMoney(i.amountCents);
  }
  return columns;
}
