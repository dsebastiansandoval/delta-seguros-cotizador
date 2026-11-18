"use client";

import { startTransition, useActionState, useState, type ChangeEvent } from "react";
import { saveHealthOfferConfiguration } from "@/actions/health-quote.actions";
import type { ActionResult } from "@/actions/quote.actions";
import type { HealthComparisonRow } from "@/domains/health/services/health-comparison.service";
import { planLabel } from "@/domains/health/services/health-offer-format";
import { HEALTH_PLANS } from "@/domains/health/health-plans.generated";

function isManualPlan(row: HealthComparisonRow) {
  return HEALTH_PLANS.some((p) => p.insurerCode === row.insurerCode && p.planCode === row.planCode && p.manual);
}

function isManualRow(row: HealthComparisonRow) {
  return row.status === "PENDIENTE_MANUAL" || isManualPlan(row);
}
import { formatUSD } from "@/domains/shared/money";

/**
 * Interruptor MOSTRAR/OCULTAR — mismo look que los switches reales de
 * OFERTA AM (confirmado en el .xlsm: son shapes agrupadas tipo switch, una
 * por columna de plan, nunca por persona — toda la familia comparte el
 * mismo plan dentro de una aseguradora). Checkbox real por debajo
 * (accesible, mismo `name`/`value`/`onChange` de siempre), solo se le
 * cambia el estilo visual.
 */
function ToggleSwitch({
  checked,
  disabled,
  title,
  ariaLabel,
  name,
  value,
  onChange,
  readOnly,
}: {
  checked: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  title?: string;
  ariaLabel: string;
  name?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className={`relative inline-flex h-5 w-9 shrink-0 items-center ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        readOnly={readOnly}
        onChange={onChange}
        title={title}
        aria-label={ariaLabel}
        className="peer sr-only"
      />
      <span className="absolute inset-0 rounded-full bg-border-strong transition-colors peer-checked:bg-good peer-focus-visible:ring-2 peer-focus-visible:ring-link" />
      <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
    </label>
  );
}

/** Equivalente a los switches MOSTRAR/OCULTAR de cada plan en OFERTA AM, agrupados por aseguradora. */
export function HealthOfferConfigurationForm({ quoteId, rows }: { quoteId: string; rows: HealthComparisonRow[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveHealthOfferConfiguration, null);
  // Un plan manual sin prima nunca puede salir en la comparativa (caratula-am.service.ts
  // exige totalPremiumCents) — si quedó marcado así de una sesión anterior (dato
  // inconsistente), se descarta acá para que "Guardar" lo corrija solo.
  const [included, setIncluded] = useState(
    () => new Set(rows.filter((r) => r.includedInOffer && (!isManualRow(r) || r.netPremiumCents != null)).map((r) => r.quoteOptionId)),
  );

  const toggle = (id: string, on: boolean) =>
    setIncluded((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  // Planes sin tabla (BUPA): se digitan; el resto viene del motor. Se fija al montar para que
  // un plan manual ya digitado siga editable.
  const [manualIds] = useState(() => new Set(rows.filter(isManualRow).map((r) => r.quoteOptionId)));

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

      {/* Columnas en vez de grid: con grid, una fila de 2 columnas estira la
          tarjeta corta a la altura de la más alta (align-items: stretch por
          default), dejando espacio en blanco adentro — las aseguradoras
          tienen muy distinto número de planes entre sí. `columns` arma cada
          tarjeta a su propia altura y la siguiente fluye a la columna con
          espacio libre (como Pinterest), sin huecos. */}
      <div className="columns-1 gap-4 lg:columns-2">
        {[...byInsurer.entries()].map(([insurerName, plans]) => (
          <section key={insurerName} className="mb-4 break-inside-avoid overflow-hidden rounded-xl border border-border shadow-sm">
            <h2 className="bg-delta-navy px-4 py-2 text-xs font-bold uppercase tracking-wide text-white">{insurerName}</h2>
            <ul className="divide-y divide-border bg-surface">
              {plans.map((row) => (
                <li key={row.quoteOptionId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  {manualIds.has(row.quoteOptionId) ? (
                    // Sin tabla de tarifas: no se puede marcar "a mano" sin prima — quedaría
                    // marcado pero invisible en la comparativa (caratula-am.service.ts exige
                    // totalPremiumCents). Se marca solo, al digitar la prima, más abajo.
                    <ToggleSwitch
                      checked={included.has(row.quoteOptionId)}
                      disabled
                      readOnly
                      title="Se marca solo al digitar la prima neta"
                      ariaLabel={`Mostrar ${planLabel(row.planCode)}`}
                    />
                  ) : (
                    <ToggleSwitch
                      name="included"
                      value={row.quoteOptionId}
                      checked={included.has(row.quoteOptionId)}
                      onChange={(e) => toggle(row.quoteOptionId, e.target.checked)}
                      ariaLabel={`Mostrar ${planLabel(row.planCode)}`}
                    />
                  )}
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
                      {included.has(row.quoteOptionId) && <input type="hidden" name="included" value={row.quoteOptionId} />}
                      <input type="hidden" name="premiumOptionId" value={row.quoteOptionId} />
                      <input
                        name={`premium:${row.quoteOptionId}`}
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={row.netPremiumCents != null ? row.netPremiumCents / 100 : ""}
                        placeholder="Prima neta USD"
                        onChange={(e) => toggle(row.quoteOptionId, e.target.value !== "")}
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
