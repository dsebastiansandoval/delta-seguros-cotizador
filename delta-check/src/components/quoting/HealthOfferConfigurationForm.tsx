"use client";

import { startTransition, useActionState, useState } from "react";
import { saveHealthOfferConfiguration } from "@/actions/health-quote.actions";
import type { ActionResult } from "@/actions/quote.actions";
import type { HealthComparisonRow } from "@/domains/health/services/health-comparison.service";
import { planLabel } from "@/domains/health/services/health-offer-format";
import { HEALTH_PLANS } from "@/domains/health/health-plans.generated";

function isManualPlan(row: HealthComparisonRow) {
  return HEALTH_PLANS.some((p) => p.insurerCode === row.insurerCode && p.planCode === row.planCode && p.manual);
}
import { formatUSD } from "@/domains/shared/money";

/** Equivalente a los botones MOSTRAR/OCULTAR de cada plan en OFERTA AM, agrupados por aseguradora. */
export function HealthOfferConfigurationForm({ quoteId, rows }: { quoteId: string; rows: HealthComparisonRow[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveHealthOfferConfiguration, null);
  const [included, setIncluded] = useState(() => new Set(rows.filter((r) => r.includedInOffer).map((r) => r.quoteOptionId)));

  const toggle = (id: string, on: boolean) =>
    setIncluded((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  // Planes sin tabla (BUPA): se digitan; el resto viene del motor. Se fija al montar para que
  // un plan manual ya digitado siga editable.
  const [manualIds] = useState(() => new Set(rows.filter((r) => r.status === "PENDIENTE_MANUAL" || isManualPlan(r)).map((r) => r.quoteOptionId)));

  const byInsurer = new Map<string, HealthComparisonRow[]>();
  for (const row of rows) byInsurer.set(row.insurerName, [...(byInsurer.get(row.insurerName) ?? []), row]);

  // Se envía a mano para que React no reinicie el formulario tras la acción.
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="quoteId" value={quoteId} />
      <p className="text-sm text-muted">{included.size} planes marcados para la oferta.</p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[...byInsurer.entries()].map(([insurerName, plans]) => (
          <section key={insurerName} className="rounded-xl border border-border bg-surface shadow-sm">
            <h2 className="border-b border-border px-4 py-2 text-xs font-bold uppercase tracking-wide">{insurerName}</h2>
            <ul className="divide-y divide-border">
              {plans.map((row) => (
                <li key={row.quoteOptionId} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <input
                    type="checkbox"
                    name="included"
                    value={row.quoteOptionId}
                    checked={included.has(row.quoteOptionId)}
                    onChange={(e) => toggle(row.quoteOptionId, e.target.checked)}
                    aria-label={`Mostrar ${planLabel(row.planCode)}`}
                  />
                  <span className="flex-1">{row.planCode ? planLabel(row.planCode) : "Prima neta del grupo"}</span>
                  {!manualIds.has(row.quoteOptionId) ? (
                    <>
                      <span className="font-semibold tabular-nums">{formatUSD(row.totalPremiumCents ?? 0)}</span>
                      <a
                        href={`/cotizar/salud/${quoteId}/opciones/${row.quoteOptionId}/coberturas`}
                        className="text-xs font-semibold text-link underline"
                      >
                        Detalles
                      </a>
                    </>
                  ) : (
                    <>
                      <input type="hidden" name="premiumOptionId" value={row.quoteOptionId} />
                      <input
                        name={`premium:${row.quoteOptionId}`}
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={row.netPremiumCents != null ? row.netPremiumCents / 100 : ""}
                        placeholder="Prima neta USD"
                        onChange={(e) => e.target.value && toggle(row.quoteOptionId, true)}
                        className="w-32 rounded-md border border-border bg-surface px-2 py-1 text-right text-xs"
                      />
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" name="intent" value="save" disabled={pending} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60">
          Guardar
        </button>
        <button type="submit" name="intent" value="compare" disabled={pending} className="rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Guardando…" : "Ver comparativa →"}
        </button>
        {state?.ok === true && <span className="text-sm font-semibold text-good">Guardado.</span>}
        {state?.ok === false && "form" in state.errors && <span className="text-sm text-bad">{state.errors.form[0]}</span>}
      </div>
    </form>
  );
}
