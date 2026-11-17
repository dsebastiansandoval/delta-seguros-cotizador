"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DeleteQuoteButton } from "@/components/quoting/DeleteQuoteButton";

export type MyQuoteRow = {
  id: string;
  code: string;
  status: "BORRADOR" | "ENVIADA" | "ACEPTADA" | "VENCIDA";
  operationType: "NUEVA" | "RENOVACION";
  createdAt: Date | string;
  documentNumber: string;
  agentName: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  ENVIADA: "Enviada",
  ACEPTADA: "Aceptada",
  VENCIDA: "Vencida",
};

const STATUS_STYLE: Record<string, string> = {
  BORRADOR: "bg-warn-bg text-warn",
  ENVIADA: "bg-accent-100 text-highlight",
  ACEPTADA: "bg-good-bg text-good",
  VENCIDA: "bg-bad-bg text-bad",
};

type SortKey = "code" | "status" | "createdAt" | "documentNumber";

function SortHeader({
  label,
  k,
  sortKey,
  sortDir,
  onToggle,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onToggle: (k: SortKey) => void;
}) {
  return (
    <th className="px-4 py-3">
      <button type="button" onClick={() => onToggle(k)} className="flex items-center gap-1 font-semibold uppercase tracking-wide">
        {label}
        <span className="text-[10px]">{sortKey === k ? (sortDir === "asc" ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
}

/**
 * "Mis cotizaciones"/"Cotizaciones" (Autos y Salud comparten la misma
 * forma de fila) — filtro de estado + orden por columna, todo en el
 * cliente: como mucho 200 filas (el límite de
 * listMyAutoQuotes/listMyHealthQuotes), no vale la pena un roundtrip al
 * servidor por esto.
 */
export function MyQuotesTable({
  items,
  branch,
  canDelete,
  showAgent,
}: {
  items: MyQuoteRow[];
  branch: "autos" | "salud";
  canDelete: boolean;
  /** quote:read_all (ADMIN/SUPERVISOR) ve la de todos — ahí sí importa de quién es cada una. */
  showAgent: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const rows = statusFilter === "TODOS" ? items : items.filter((r) => r.status === statusFilter);
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "createdAt") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else cmp = a[sortKey].localeCompare(b[sortKey]);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [items, statusFilter, sortKey, sortDir]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="status-filter">
          Estado
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
        >
          <option value="TODOS">Todos</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted">
          Ninguna cotización con ese estado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <SortHeader label="Código" k="code" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <SortHeader label="Cédula" k="documentNumber" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                {showAgent && <th className="px-4 py-3">Agente</th>}
                <th className="px-4 py-3">Tipo</th>
                <SortHeader label="Estado" k="status" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <SortHeader label="Creada" k="createdAt" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr key={q.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{q.code}</td>
                  <td className="px-4 py-3 text-muted">{q.documentNumber}</td>
                  {showAgent && <td className="px-4 py-3 text-muted">{q.agentName ?? "—"}</td>}
                  <td className="px-4 py-3 text-muted">{q.operationType === "RENOVACION" ? "Renovación" : "Nueva"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[q.status]}`}>
                      {STATUS_LABEL[q.status] ?? q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{new Date(q.createdAt).toLocaleDateString("es-EC")}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-3">
                      <Link href={`/cotizar/${branch}/${q.id}/comparar`} className="text-xs font-semibold text-link underline">
                        {q.status === "BORRADOR" ? "Continuar" : "Ver"}
                      </Link>
                      {canDelete && <DeleteQuoteButton quoteId={q.id} quoteCode={q.code} />}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
