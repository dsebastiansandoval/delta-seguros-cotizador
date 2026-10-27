/**
 * CSV de tarifas de Salud de UNA aseguradora — lo que el ADMIN sube en
 * /admin/tarifas-salud cuando la aseguradora actualiza su tabla. Mismas
 * columnas que health_rate_rules. Se acepta lo que exporta Excel en
 * español: separador `;`, coma decimal y BOM. Sin dependencias de la DB:
 * corre en el navegador (vista previa) y en el servidor (validación final).
 */

export const HEALTH_RATE_CSV_HEADER = ["plan", "relacion", "edad_desde", "edad_hasta", "sexo", "region", "prima"] as const;

export type HealthRateCsvRow = {
  planCode: string;
  relation: "TITULAR" | "DEPENDIENTE" | null;
  ageMin: number;
  ageMax: number;
  gender: "MASCULINO" | "FEMENINO" | null;
  region: "COSTA" | "SIERRA" | "AUSTRO" | null;
  premiumCents: number;
};

export type HealthRateCsvResult = {
  rows: HealthRateCsvRow[];
  errors: string[];
  /** Planes de la tabla vigente que no vienen en el archivo — dejarían de cotizarse. */
  missingPlans: string[];
};

const MAX_ERRORS = 20;
const MAX_AGE = 999;

const RELATIONS: Record<string, HealthRateCsvRow["relation"]> = { TITULAR: "TITULAR", DEPENDIENTE: "DEPENDIENTE" };
const GENDERS: Record<string, HealthRateCsvRow["gender"]> = {
  M: "MASCULINO",
  MASCULINO: "MASCULINO",
  F: "FEMENINO",
  FEMENINO: "FEMENINO",
};
const REGIONS: Record<string, HealthRateCsvRow["region"]> = { COSTA: "COSTA", SIERRA: "SIERRA", AUSTRO: "AUSTRO" };

function splitCsv(raw: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inQuotes) {
      if (c === '"' && raw[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && raw[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

/** "2235.96", "2235,96", "2.235,96", "2,235.96", "$2235.96" → centavos. */
export function parseMoneyCents(value: string): number | null {
  let s = value.replace(/[\s$]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

function parseAge(value: string): number | null {
  const s = value.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  // 999 = "en adelante" en las tablas del Excel (último tramo de edad).
  return n <= MAX_AGE ? n : null;
}

/** Vacío = aplica a cualquiera (igual que null en health_rate_rules). */
function parseOptional<T>(value: string, allowed: Record<string, T>): T | null | undefined {
  const s = value.trim().toUpperCase();
  if (!s) return null;
  return s in allowed ? allowed[s] : undefined;
}

export function parseHealthRateCsv(
  raw: string,
  options: { validPlanCodes: string[]; currentPlanCodes?: string[] },
): HealthRateCsvResult {
  const text = raw.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const [header = [], ...dataRows] = splitCsv(text, delimiter);

  const errors: string[] = [];
  const addError = (message: string) => {
    if (errors.length < MAX_ERRORS) errors.push(message);
  };

  const columns = header.map((h) => h.trim().toLowerCase());
  const index = Object.fromEntries(HEALTH_RATE_CSV_HEADER.map((name) => [name, columns.indexOf(name)]));
  const missingColumns = HEALTH_RATE_CSV_HEADER.filter((name) => index[name] === -1);
  if (missingColumns.length) {
    return { rows: [], errors: [`Faltan columnas: ${missingColumns.join(", ")}`], missingPlans: [] };
  }
  if (!dataRows.length) return { rows: [], errors: ["El archivo no tiene filas de tarifa"], missingPlans: [] };

  const validPlans = new Set(options.validPlanCodes);
  const rows: HealthRateCsvRow[] = [];

  dataRows.forEach((cells, i) => {
    const line = i + 2; // +1 por el encabezado, +1 porque Excel numera desde 1
    const cell = (name: (typeof HEALTH_RATE_CSV_HEADER)[number]) => (cells[index[name]] ?? "").trim();

    const planCode = cell("plan").toUpperCase();
    const relation = parseOptional(cell("relacion"), RELATIONS);
    const gender = parseOptional(cell("sexo"), GENDERS);
    const region = parseOptional(cell("region"), REGIONS);
    const ageMin = parseAge(cell("edad_desde"));
    const ageMax = parseAge(cell("edad_hasta"));
    const premiumCents = parseMoneyCents(cell("prima"));

    const problems: string[] = [];
    if (!validPlans.has(planCode)) problems.push(`plan "${cell("plan")}" no existe para esta aseguradora`);
    if (relation === undefined) problems.push(`relación "${cell("relacion")}" (TITULAR, DEPENDIENTE o vacío)`);
    if (gender === undefined) problems.push(`sexo "${cell("sexo")}" (MASCULINO, FEMENINO o vacío)`);
    if (region === undefined) problems.push(`región "${cell("region")}" (COSTA, SIERRA, AUSTRO o vacío)`);
    if (ageMin === null || ageMax === null) problems.push(`edades deben ser números enteros entre 0 y ${MAX_AGE}`);
    else if (ageMin > ageMax) problems.push("edad_desde es mayor que edad_hasta");
    if (premiumCents === null || premiumCents <= 0) problems.push(`prima "${cell("prima")}" inválida`);

    if (problems.length) {
      addError(`Fila ${line}: ${problems.join("; ")}`);
      return;
    }
    rows.push({
      planCode,
      relation: relation!,
      gender: gender!,
      region: region!,
      ageMin: ageMin!,
      ageMax: ageMax!,
      premiumCents: premiumCents!,
    });
  });

  // Dos filas con la misma combinación y edades que se pisan darían dos primas para la misma persona.
  const byKey = new Map<string, HealthRateCsvRow[]>();
  for (const row of rows) {
    const key = [row.planCode, row.relation, row.gender, row.region].join("|");
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }
  for (const group of byKey.values()) {
    const sorted = [...group].sort((a, b) => a.ageMin - b.ageMin);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (cur.ageMin <= prev.ageMax) {
        const who = [cur.relation, cur.gender, cur.region].filter(Boolean).join(" ");
        addError(`${cur.planCode}${who ? ` ${who}` : ""}: las edades ${prev.ageMin}-${prev.ageMax} y ${cur.ageMin}-${cur.ageMax} se superponen`);
      }
    }
  }

  const uploaded = new Set(rows.map((r) => r.planCode));
  const missingPlans = (options.currentPlanCodes ?? []).filter((code) => !uploaded.has(code));

  return { rows: errors.length ? [] : rows, errors, missingPlans };
}

function csvCell(value: string | number | null) {
  return value == null ? "" : String(value);
}

/** La tabla vigente como CSV — sirve de plantilla para la próxima actualización. */
export function healthRatesToCsv(rows: HealthRateCsvRow[]): string {
  const lines = rows.map((r) =>
    [r.planCode, r.relation, r.ageMin, r.ageMax, r.gender, r.region, (r.premiumCents / 100).toFixed(2)].map(csvCell).join(","),
  );
  return `﻿${[HEALTH_RATE_CSV_HEADER.join(","), ...lines].join("\r\n")}\r\n`;
}

/**
 * Plantilla vacía para una aseguradora que todavía no tiene ninguna tabla
 * cargada — sin esto, el ADMIN tenía que armar el CSV a mano y adivinar los
 * códigos de plan exactos (tienen que calzar con `ratedPlanCodes`, si no
 * `parseHealthRateCsv` rechaza la fila). Una fila por plan, con el código ya
 * puesto y el resto vacío para llenar.
 */
export function blankHealthRateCsv(planCodes: string[]): string {
  const lines = planCodes.map((code) => [code, "", "", "", "", "", ""].join(","));
  return `﻿${[HEALTH_RATE_CSV_HEADER.join(","), ...lines].join("\r\n")}\r\n`;
}
