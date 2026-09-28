"use client";

import { useActionState, useState } from "react";
import { formatUSD } from "@/domains/shared/money";
import { ManualPremiumForm } from "@/components/quoting/ManualPremiumForm";
import { KM_BRACKETS, KM_BRACKET_LABELS } from "@/domains/quoting/constants";
import { runQuoteComparison, type ActionResult } from "@/actions/quote.actions";
import type { ComparisonRow } from "@/domains/quoting/services/comparison.service";

export type RiskGroup = {
  risk: { id: string; riskNumber: number };
  vehicle: { plate: string; brand: string; model: string; year: number } | null;
  rows: ComparisonRow[];
};

const runInitialState: ActionResult | null = null;

/**
 * Una cotización trae 1-4 riesgos (vehículos, EXCEL-AUDIT.md §5) — cada
 * uno con su propio comparador y su propia selección para la carátula
 * (nunca se mezclan aseguradoras de dos vehículos distintos en un mismo
 * PDF). Un riesgo recién guardado como borrador todavía no tiene filas —
 * "Generar comparativa" corre el motor de las 13 aseguradoras recién ahí,
 * sin tener que rehacer el formulario de cero.
 */
export function AutosComparisonView({ quoteId, quoteCode, riskGroups }: { quoteId: string; quoteCode: string; riskGroups: RiskGroup[] }) {
  const [runState, runAction, running] = useActionState(runQuoteComparison, runInitialState);
  const isKm = riskGroups.some((g) => g.rows.some((r) => r.modality === "POR_KM"));
  const anyUncompared = riskGroups.some((g) => g.rows.length === 0);

  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Comparativa — {quoteCode} {isKm && <span className="text-muted">(Auto x Km)</span>}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {riskGroups.length > 1 ? `${riskGroups.length} riesgos en esta cotización` : "1 riesgo en esta cotización"}
          </p>
        </div>
        {anyUncompared && (
          <form action={runAction}>
            <input type="hidden" name="quoteId" value={quoteId} />
            <button
              type="submit"
              disabled={running}
              className="shrink-0 rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {running ? "Generando…" : "Generar comparativa →"}
            </button>
          </form>
        )}
      </header>
      {runState?.ok === false && "form" in runState.errors && (
        <p className="mb-4 text-sm text-red-600">{runState.errors.form[0]}</p>
      )}

      <div className="flex flex-col gap-8">
        {riskGroups.map((group) => (
          <RiskSection key={group.risk.id} quoteId={quoteId} group={group} showHeading={riskGroups.length > 1} />
        ))}
      </div>
    </>
  );
}

function RiskSection({ quoteId, group, showHeading }: { quoteId: string; group: RiskGroup; showHeading: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { risk, vehicle, rows } = group;
  const isKm = rows[0]?.modality === "POR_KM";
  const hasCotizado = rows.some((r) => r.status === "COTIZADO");

  function toggle(quoteOptionId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(quoteOptionId)) next.delete(quoteOptionId);
      else next.add(quoteOptionId);
      return next;
    });
  }

  const downloadHref =
    selected.size > 0
      ? `/api/quotes/${quoteId}/caratula?${[...selected].map((id) => `quoteOptionId=${id}`).join("&")}`
      : `/api/quotes/${quoteId}/caratula`;

  return (
    <section>
      {showHeading && (
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
          Riesgo {risk.riskNumber}
          {vehicle && ` — ${vehicle.brand} ${vehicle.model} ${vehicle.year} (${vehicle.plate})`}
        </h2>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted">
          Todavía no se generó la comparativa para este riesgo — usa &quot;Generar comparativa&quot; arriba.
        </div>
      ) : (
        <>
          {!isKm && hasCotizado && (
            <div className="mb-3 flex justify-end">
              <a
                href={downloadHref}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white"
              >
                {selected.size > 1 ? `Descargar carátula comparativa (${selected.size})` : "Descargar carátula PDF"}
              </a>
            </div>
          )}
          {isKm ? (
            <KmComparisonTable rows={rows} quoteId={quoteId} />
          ) : (
            <AnnualComparisonTable rows={rows} quoteId={quoteId} selected={selected} onToggle={toggle} />
          )}
        </>
      )}
    </section>
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
          {rows.map((row) => {
            const isBest = row.insurerId === best?.insurerId;
            return (
            <tr key={row.insurerId} className={`border-b border-border last:border-0 ${isBest ? "bg-accent-100" : ""}`}>
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
                  <div className="flex flex-col items-end gap-1">
                    <span className={isBest ? "text-highlight" : ""}>{formatUSD(row.totalPremiumCents)}</span>
                    {isBest && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-delta-navy px-2 py-0.5 text-[10.5px] font-bold tracking-wide text-white">
                        ★ Mejor opción
                      </span>
                    )}
                  </div>
                ) : (
                  <ManualPremiumForm quoteOptionId={row.quoteOptionId} quoteId={quoteId} />
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {row.totalPremiumCents != null && (
                  <div className="flex flex-col items-end gap-1">
                    <a
                      href={`/cotizar/autos/${quoteId}/opciones/${row.quoteOptionId}/coberturas`}
                      className="whitespace-nowrap text-xs font-semibold text-link underline"
                    >
                      Coberturas
                    </a>
                    <a
                      href={`/cartera/emitir?quoteOptionId=${row.quoteOptionId}`}
                      className="whitespace-nowrap text-xs font-semibold text-link underline"
                    >
                      Emitir póliza
                    </a>
                  </div>
                )}
              </td>
            </tr>
            );
          })}
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
