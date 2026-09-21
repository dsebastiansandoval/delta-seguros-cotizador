"use client";

import { useState } from "react";
import { formatUSD } from "@/domains/shared/money";
import { ManualPremiumForm } from "@/components/quoting/ManualPremiumForm";
import { KM_BRACKETS, KM_BRACKET_LABELS } from "@/domains/quoting/constants";
import type { ComparisonRow } from "@/domains/quoting/services/comparison.service";

/**
 * Antes, "Descargar carátula PDF" siempre mandaba la más barata — sin
 * elegir nada. Ahora se puede tildar varias aseguradoras COTIZADO en la
 * tabla y el PDF trae una página completa por cada una elegida (mismo
 * formato que ya existía, repetido) — a pedido del usuario. Sin ninguna
 * tildada, se mantiene el comportamiento de siempre (la más barata).
 */
export function AutosComparisonView({
  quoteId,
  quoteCode,
  rows,
  isKm,
}: {
  quoteId: string;
  quoteCode: string;
  rows: ComparisonRow[];
  isKm: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(quoteOptionId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(quoteOptionId)) next.delete(quoteOptionId);
      else next.add(quoteOptionId);
      return next;
    });
  }

  const hasCotizado = rows.some((r) => r.status === "COTIZADO");
  const downloadHref =
    selected.size > 0
      ? `/api/quotes/${quoteId}/caratula?${[...selected].map((id) => `quoteOptionId=${id}`).join("&")}`
      : `/api/quotes/${quoteId}/caratula`;

  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Comparativa — {quoteCode} {isKm && <span className="text-muted">(Auto x Km)</span>}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {isKm ? (
              <>{new Set(rows.map((r) => r.insurerId)).size} aseguradoras · digitación manual por rango de km</>
            ) : (
              <>
                {rows.length} aseguradoras · {rows.filter((r) => r.status === "COTIZADO").length}{" "}
                con prima calculada, {rows.filter((r) => r.status === "PENDIENTE_MANUAL").length}{" "}
                pendientes de digitar
              </>
            )}
          </p>
        </div>
        {hasCotizado && (
          <a
            href={downloadHref}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white"
          >
            {selected.size > 1 ? `Descargar carátula comparativa (${selected.size})` : "Descargar carátula PDF"}
          </a>
        )}
      </header>

      {isKm ? (
        <KmComparisonTable rows={rows} quoteId={quoteId} />
      ) : (
        <AnnualComparisonTable rows={rows} quoteId={quoteId} selected={selected} onToggle={toggle} />
      )}
    </>
  );
}

function AnnualComparisonTable({
  rows,
  quoteId,
  selected,
  onToggle,
}: {
  rows: ComparisonRow[];
  quoteId: string;
  selected: Set<string>;
  onToggle: (quoteOptionId: string) => void;
}) {
  const best = rows.find((r) => r.status === "COTIZADO");

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
            <th className="w-8 px-4 py-3" title="Elegir para la carátula comparativa" />
            <th className="px-4 py-3">Aseguradora</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Tasa</th>
            <th className="px-4 py-3 text-right">Prima total</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.insurerId} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                {row.totalPremiumCents != null && (
                  <input
                    type="checkbox"
                    checked={selected.has(row.quoteOptionId)}
                    onChange={() => onToggle(row.quoteOptionId)}
                    title="Incluir en la carátula comparativa"
                  />
                )}
              </td>
              <td className="px-4 py-3 font-medium">{row.insurerName}</td>
              <td className="px-4 py-3">
                {row.status === "COTIZADO" ? (
                  <span className="rounded-full bg-good-bg px-2 py-0.5 text-xs font-semibold text-good">
                    Cotizado
                  </span>
                ) : (
                  <span className="rounded-full bg-warn-bg px-2 py-0.5 text-xs font-semibold text-warn">
                    Pendiente — digitar
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-muted">
                {row.ratePercentApplied ? `${(Number(row.ratePercentApplied) * 100).toFixed(3)}%` : "—"}
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {row.totalPremiumCents != null ? (
                  <span className={row.insurerId === best?.insurerId ? "text-highlight" : ""}>
                    {formatUSD(row.totalPremiumCents)}
                    {row.insurerId === best?.insurerId && " ★"}
                  </span>
                ) : (
                  <ManualPremiumForm quoteOptionId={row.quoteOptionId} quoteId={quoteId} />
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {row.totalPremiumCents != null && (
                  <a
                    href={`/cartera/emitir?quoteOptionId=${row.quoteOptionId}`}
                    className="whitespace-nowrap text-xs font-semibold text-link underline"
                  >
                    Emitir póliza
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Grilla aseguradora × rango de km — cada celda es su propio quote_option, todas PENDIENTE_MANUAL (§11.4b). */
function KmComparisonTable({ rows, quoteId }: { rows: ComparisonRow[]; quoteId: string }) {
  const byInsurer = new Map<string, { name: string; byBracket: Map<number, ComparisonRow> }>();
  for (const row of rows) {
    if (!byInsurer.has(row.insurerId)) {
      byInsurer.set(row.insurerId, { name: row.insurerName, byBracket: new Map() });
    }
    if (row.kmBracket != null) byInsurer.get(row.insurerId)!.byBracket.set(row.kmBracket, row);
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
            <th className="sticky left-0 bg-surface px-4 py-3">Aseguradora</th>
            {KM_BRACKETS.map((km) => (
              <th key={km} className="whitespace-nowrap px-4 py-3 text-right">
                {KM_BRACKET_LABELS[km]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...byInsurer.entries()].map(([insurerId, { name, byBracket }]) => (
            <tr key={insurerId} className="border-b border-border last:border-0">
              <td className="sticky left-0 bg-surface px-4 py-3 font-medium">{name}</td>
              {KM_BRACKETS.map((km) => {
                const cell = byBracket.get(km);
                return (
                  <td key={km} className="px-4 py-3 text-right">
                    {cell?.totalPremiumCents != null ? (
                      <span className="font-semibold tabular-nums">{formatUSD(cell.totalPremiumCents)}</span>
                    ) : cell ? (
                      <ManualPremiumForm quoteOptionId={cell.quoteOptionId} quoteId={quoteId} />
                    ) : (
                      "—"
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
