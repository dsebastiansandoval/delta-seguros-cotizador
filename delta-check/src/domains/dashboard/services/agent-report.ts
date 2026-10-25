/**
 * Reporte de producción por ejecutivo — equivalente a filtrar BASE
 * VEHICULOS por EJECUTIVO y MES (FECHA COTIZACION) y cruzarla con BASE
 * EMISIONES (ESTATUS / PRIMA ACTUAL). Las emisiones se cuentan sobre las
 * cotizaciones del mes (cohorte), no por la fecha de emisión, para que la
 * conversión compare lo mismo.
 */

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export type ReportMonth = { value: string; label: string; start: Date; end: Date };

function monthAt(year: number, monthIndex: number): ReportMonth {
  const start = new Date(year, monthIndex, 1);
  return {
    value: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
    label: `${MONTHS[start.getMonth()]} ${start.getFullYear()}`,
    start,
    end: new Date(start.getFullYear(), start.getMonth() + 1, 1),
  };
}

/** `mes=YYYY-MM` de la URL; si falta o no es válido, el mes en curso. */
export function parseReportMonth(value: string | undefined, now = new Date()): ReportMonth {
  const match = value?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  return match ? monthAt(Number(match[1]), Number(match[2]) - 1) : monthAt(now.getFullYear(), now.getMonth());
}

/** Mes en curso y los `count - 1` anteriores, del más reciente al más antiguo. */
export function recentMonths(count: number, now = new Date()): ReportMonth[] {
  return Array.from({ length: count }, (_, i) => monthAt(now.getFullYear(), now.getMonth() - i));
}

export type QuotedRow = { agentId: string; quotes: number; risks: number };
export type IssuedRow = { agentId: string; convertedQuotes: number; policies: number; premiumCents: number };

export type AgentReportRow = {
  agentId: string;
  agentName: string;
  quotes: number;
  risks: number;
  policies: number;
  conversionRate: number;
  premiumCents: number;
};

export function buildAgentReport(quoted: QuotedRow[], issued: IssuedRow[], agentNames: Map<string, string>) {
  const issuedByAgent = new Map(issued.map((r) => [r.agentId, r]));
  const rows: AgentReportRow[] = quoted
    .map((q) => {
      const i = issuedByAgent.get(q.agentId);
      return {
        agentId: q.agentId,
        agentName: agentNames.get(q.agentId) ?? "—",
        quotes: q.quotes,
        risks: q.risks,
        policies: i?.policies ?? 0,
        conversionRate: q.quotes > 0 ? (i?.convertedQuotes ?? 0) / q.quotes : 0,
        premiumCents: i?.premiumCents ?? 0,
      };
    })
    .sort((a, b) => b.quotes - a.quotes || a.agentName.localeCompare(b.agentName));

  const quotes = rows.reduce((s, r) => s + r.quotes, 0);
  const converted = issued.reduce((s, r) => s + r.convertedQuotes, 0);
  return {
    rows,
    totals: {
      quotes,
      risks: rows.reduce((s, r) => s + r.risks, 0),
      policies: rows.reduce((s, r) => s + r.policies, 0),
      conversionRate: quotes > 0 ? converted / quotes : 0,
      premiumCents: rows.reduce((s, r) => s + r.premiumCents, 0),
    },
  };
}
