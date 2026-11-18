"use client";

import { useMemo, useState } from "react";
import { formatUSD } from "@/domains/shared/money";
import { daysSince } from "@/domains/shared/days-since";
import { CLAIM_STATUSES, CLAIM_STATUS_LABEL } from "@/domains/policies/claim-status-labels";

const STATUS_STYLE: Record<string, string> = {
  REPORTADO: "bg-warn-bg text-warn",
  APROBADO: "bg-accent-100 text-highlight",
  REPARADO: "bg-accent-100 text-highlight",
  ENTREGADO: "bg-good-bg text-good",
};

export type ClaimRow = {
  id: string;
  policyId: string | null;
  status: string;
  occurredAt: string | null;
  reportedAt: string | null;
  policyNumber: string | null;
  insurerName: string | null;
  standaloneInsurerName: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientBusinessName: string | null;
  standaloneClientName: string | null;
  claimValueCents: number | null;
};

type SortKey = "cliente" | "aseguradora" | "occurredAt" | "reportedAt" | "dias" | "valor" | "status";

function SortHeader({
  label,
  k,
  right,
  sortKey,
  sortDir,
  onToggle,
}: {
  label: string;
  k: SortKey;
  right?: boolean;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onToggle: (k: SortKey) => void;
}) {
  return (
    <th className={`px-4 py-3 ${right ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={() => onToggle(k)}
        className={`flex items-center gap-1 whitespace-nowrap font-semibold uppercase tracking-wide ${right ? "ml-auto" : ""}`}
      >
        {label}
        <span className="text-[10px]">{sortKey === k ? (sortDir === "asc" ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
}

/** Lista de Siniestros — filtro de estado + orden por columna, en el cliente (la búsqueda por texto sigue yendo al servidor, ver page.tsx). */
export function ClaimsTable({ claims }: { claims: ClaimRow[] }) {
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");
  const [sortKey, setSortKey] = useState<SortKey>("reportedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const rows = useMemo(() => {
    return claims.map((c) => ({
      ...c,
      clientName: c.clientBusinessName || `${c.clientFirstName ?? ""} ${c.clientLastName ?? ""}`.trim() || c.standaloneClientName || "",
      insurerName: c.insurerName ?? c.standaloneInsurerName ?? "",
      dias: daysSince(c.reportedAt) ?? -1,
    }));
  }, [claims]);

  const filtered = useMemo(() => {
    const base = statusFilter === "TODOS" ? rows : rows.filter((r) => r.status === statusFilter);
    return [...base].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "cliente":
          cmp = a.clientName.localeCompare(b.clientName);
          break;
        case "aseguradora":
          cmp = a.insurerName.localeCompare(b.insurerName);
          break;
        case "occurredAt":
          cmp = (a.occurredAt ?? "").localeCompare(b.occurredAt ?? "");
          break;
        case "reportedAt":
          cmp = (a.reportedAt ?? "").localeCompare(b.reportedAt ?? "");
          break;
        case "dias":
          cmp = a.dias - b.dias;
          break;
        case "valor":
          cmp = (a.claimValueCents ?? -1) - (b.claimValueCents ?? -1);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, statusFilter, sortKey, sortDir]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="claim-status-filter">
          Estado
        </label>
        <select
          id="claim-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
        >
          <option value="TODOS">Todos</option>
          {CLAIM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CLAIM_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="whitespace-nowrap px-4 py-3">Póliza</th>
              <SortHeader label="Cliente" k="cliente" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
              <SortHeader label="Aseguradora" k="aseguradora" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
              <SortHeader label="Ocurrido" k="occurredAt" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
              <SortHeader label="Reportado" k="reportedAt" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
              <SortHeader label="Días" k="dias" right sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
              <SortHeader label="Valor" k="valor" right sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
              <SortHeader label="Estado" k="status" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap px-4 py-3">
                  {c.policyId ? (
                    <a href={`/cartera/${c.policyId}`} className="text-link underline">
                      {c.policyNumber || "(sin número)"}
                    </a>
                  ) : (
                    <span>
                      {c.policyNumber || "(sin número)"}{" "}
                      <span className="text-xs text-muted" title="Reportado sin vincular a una póliza de Cartera">
                        · sin póliza
                      </span>
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{c.clientName || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3">{c.insurerName || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3">{c.occurredAt || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3">{c.reportedAt || "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{c.dias >= 0 ? c.dias : "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {c.claimValueCents != null ? formatUSD(c.claimValueCents) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[c.status] ?? ""}`}>
                    {CLAIM_STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <a href={`/siniestros/${c.id}`} className="text-xs font-semibold text-link underline">
                    Gestionar
                  </a>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted">
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
