"use client";

import { startTransition, useActionState, useState } from "react";
import { saveOfferConfiguration } from "@/actions/offer.actions";
import type { ActionResult } from "@/actions/quote.actions";
import type { ConfigurationColumn, OfferConfiguration } from "@/domains/quoting/offer/offer.service";
import { KM_BRACKETS, KM_BRACKET_LABELS } from "@/domains/quoting/constants";
import { centsToDollars, dollarsToCents, formatUSD } from "@/domains/shared/money";

const cellInput = "w-full rounded-md border border-border bg-surface px-2 py-1 text-xs";
const labelCell = "sticky left-0 z-10 bg-surface px-3 py-2 text-xs font-semibold text-muted whitespace-nowrap";

function formatRatePercent(rate: number) {
  return `${(rate * 100).toFixed(2)}%`;
}

function formatRate(rate: string | null) {
  return rate == null ? "" : formatRatePercent(Number(rate));
}

function dollars(cents: number | null) {
  return cents == null ? "" : String(centsToDollars(cents));
}

/**
 * Prima neta anual: la tasa es prima neta / VA, sin derechos de emisión ni
 * impuestos de por medio (esos sí requieren el cálculo de premium.calculator.ts
 * y no se reimplementan aquí). Por eso se puede mostrar al instante mientras
 * se digita, sin esperar a guardar.
 */
function ManualPremiumInput({
  name,
  defaultCents,
  valueCents,
  savedRate,
  onChange,
}: {
  name: string;
  defaultCents: number | null;
  valueCents: number;
  savedRate: string | null;
  onChange: () => void;
}) {
  const [liveRate, setLiveRate] = useState<number | null>(null);

  return (
    <>
      <input
        name={name}
        type="number"
        step="0.01"
        min="0"
        defaultValue={dollars(defaultCents)}
        placeholder="Prima neta USD"
        onChange={(e) => {
          if (e.target.value) onChange();
          const dollarsValue = Number(e.target.value);
          setLiveRate(e.target.value && Number.isFinite(dollarsValue) && valueCents > 0 ? dollarsToCents(dollarsValue) / valueCents : null);
        }}
        className={`${cellInput} text-right`}
      />
      {(liveRate != null || savedRate) && (
        <span className="mt-1 block text-center text-muted">
          Tasa {liveRate != null ? formatRatePercent(liveRate) : formatRate(savedRate)}
        </span>
      )}
    </>
  );
}

/** Pantalla intermedia equivalente a la hoja DATOS OFERTA del Excel. */
export function OfferConfigurationForm({ config }: { config: OfferConfiguration }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveOfferConfiguration, null);
  const isKm = config.quote.modality === "POR_KM";

  // Se envía a mano para que React no reinicie la grilla tras la acción (si hay un error, lo digitado se conserva).
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="quoteId" value={config.quote.id} />
      {config.columns.map((c) => (
        <input key={c.insurerId} type="hidden" name="insurerId" value={c.insurerId} />
      ))}

      {isKm ? <KmGrid config={config} /> : <AnnualGrid config={config} />}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          name="intent"
          value="save"
          disabled={pending}
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          Guardar
        </button>
        <button
          type="submit"
          name="intent"
          value="compare"
          disabled={pending}
          className="rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Ver comparativa →"}
        </button>
        {state?.ok === true && <span className="text-sm font-semibold text-good">Guardado.</span>}
        {state?.ok === false && "form" in state.errors && (
          <span className="text-sm text-bad">{state.errors.form[0]}</span>
        )}
      </div>
    </form>
  );
}

function AnnualGrid({ config }: { config: OfferConfiguration }) {
  const [included, setIncluded] = useState(
    () => new Map(config.columns.map((c) => [c.insurerId, c.settings.included])),
  );
  const show = (insurerId: string) =>
    setIncluded((prev) => (prev.get(insurerId) ? prev : new Map(prev).set(insurerId, true)));

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
      <table className="text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className={labelCell} />
            {config.columns.map((c) => (
              <th key={c.insurerId} className="min-w-44 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide">
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Row label="Mostrar en oferta">
            {config.columns.map((c) => (
              <td key={c.insurerId} className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  name={`included:${c.insurerId}`}
                  checked={included.get(c.insurerId) ?? false}
                  onChange={(e) => setIncluded((prev) => new Map(prev).set(c.insurerId, e.target.checked))}
                />
              </td>
            ))}
          </Row>
          <Row label="Tipo de cobertura">
            {config.columns.map((c) => (
              <td key={c.insurerId} className="px-3 py-2">
                <select name={`coverageType:${c.insurerId}`} defaultValue={c.settings.coverageType} className={cellInput}>
                  <option value="TODO_RIESGO">Todo riesgo</option>
                  <option value="SOLO_PERDIDA_TOTAL">Solo pérdida total</option>
                </select>
              </td>
            ))}
          </Row>
          <Row label="Amparo patrimonial">
            {config.columns.map((c) => (
              <td key={c.insurerId} className="px-3 py-2 text-center">
                <input type="checkbox" name={`amparo:${c.insurerId}`} defaultChecked={c.settings.amparoPatrimonial} />
              </td>
            ))}
          </Row>
          <Row label="Responsabilidad civil">
            {config.columns.map((c) => (
              <td key={c.insurerId} className="px-3 py-2">
                <AmountSelect name={`rc:${c.insurerId}`} options={c.options.rc} current={c.settings.rcAmountCents} />
              </td>
            ))}
          </Row>
          <Row label="Gastos médicos">
            {config.columns.map((c) => (
              <td key={c.insurerId} className="px-3 py-2">
                <AmountSelect name={`gm:${c.insurerId}`} options={c.options.gm} current={c.settings.gmAmountCents} />
              </td>
            ))}
          </Row>
          <Row label="Deducible pérdidas parciales">
            {config.columns.map((c) => (
              <td key={c.insurerId} className="px-3 py-2 align-top">
                <PartialDeductible column={c} />
              </td>
            ))}
          </Row>
          <Row label="Deducible pérdida total">
            {config.columns.map((c) => (
              <td key={c.insurerId} className="px-3 py-2 align-top">
                <TextSelect name={`totalLoss:${c.insurerId}`} options={c.options.totalLossDeductible} current={c.settings.totalLossDeductible} />
              </td>
            ))}
          </Row>

          {config.risks.map((risk) => (
            <Row
              key={risk.id}
              label={
                <>
                  Prima neta — Riesgo {risk.riskNumber}
                  <span className="block font-normal">{risk.label}</span>
                  <span className="block font-normal">
                    VA {formatUSD(risk.insuredValueCents + risk.extrasValueCents)}
                  </span>
                </>
              }
            >
              {config.columns.map((c) => {
                const premium = c.premiums.find((p) => p.riskId === risk.id);
                if (!premium) return <td key={c.insurerId} className="px-3 py-2 text-center text-xs text-muted">—</td>;
                if (c.isEngine) {
                  return (
                    <td key={c.insurerId} className="px-3 py-2 text-center text-xs">
                      {premium.netPremiumCents != null ? (
                        <>
                          <span className="font-semibold tabular-nums">{formatUSD(premium.netPremiumCents)}</span>
                          <span className="block text-muted">Tasa {formatRate(premium.ratePercentApplied)}</span>
                        </>
                      ) : (
                        <span className="text-muted">No cotiza</span>
                      )}
                    </td>
                  );
                }
                return (
                  <td key={c.insurerId} className="px-3 py-2 text-xs">
                    <input type="hidden" name="premiumOptionId" value={premium.quoteOptionId} />
                    <ManualPremiumInput
                      name={`premium:${premium.quoteOptionId}`}
                      defaultCents={premium.netPremiumCents}
                      valueCents={risk.insuredValueCents + risk.extrasValueCents}
                      savedRate={premium.ratePercentApplied}
                      onChange={() => show(c.insurerId)}
                    />
                  </td>
                );
              })}
            </Row>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KmGrid({ config }: { config: OfferConfiguration }) {
  const column = config.columns[0];
  if (!column) {
    return <p className="text-sm text-muted">Ninguna aseguradora tiene habilitado Auto x Km.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name={`included:${column.insurerId}`} value="on" />
      <div className="grid max-w-3xl grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
        <p className="text-sm font-bold sm:col-span-2">{column.name} — Auto x Km</p>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          Responsabilidad civil
          <AmountSelect name={`rc:${column.insurerId}`} options={column.options.rc} current={column.settings.rcAmountCents} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          Deducible pérdidas parciales
          <PartialDeductible column={column} />
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <table className="text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className={labelCell}>Prima total del portal</th>
              {KM_BRACKETS.map((km) => (
                <th key={km} className="min-w-36 px-3 py-2 text-center text-xs font-bold">
                  {KM_BRACKET_LABELS[km]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {config.risks.map((risk) => (
              <Row key={risk.id} label={`Riesgo ${risk.riskNumber} — ${risk.label}`}>
                {KM_BRACKETS.map((km) => {
                  const premium = column.premiums.find((p) => p.riskId === risk.id && p.kmBracket === km);
                  if (!premium) return <td key={km} className="px-3 py-2 text-center text-muted">—</td>;
                  return (
                    <td key={km} className="px-3 py-2 text-xs">
                      <input type="hidden" name="premiumOptionId" value={premium.quoteOptionId} />
                      <input
                        name={`premium:${premium.quoteOptionId}`}
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={dollars(premium.totalPremiumCents)}
                        placeholder="Prima total USD"
                        className={`${cellInput} text-right`}
                      />
                      {premium.ratePercentApplied && (
                        <span className="mt-1 block text-center text-muted">Tasa {formatRate(premium.ratePercentApplied)}</span>
                      )}
                    </td>
                  );
                })}
              </Row>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <tr className="border-b border-border last:border-0">
      <th scope="row" className={`${labelCell} text-left align-top`}>
        {label}
      </th>
      {children}
    </tr>
  );
}

/** Monto fijo de la aseguradora, o selector si el Excel trae botones de opción para ella. */
function AmountSelect({ name, options, current }: { name: string; options?: number[]; current: number | null }) {
  if (!options?.length) {
    return <span className="block text-center text-xs tabular-nums">{current != null ? formatUSD(current) : "—"}</span>;
  }
  return (
    <select name={name} defaultValue={dollars(current)} className={cellInput}>
      {options.map((value) => (
        <option key={value} value={value}>
          {formatUSD(value * 100)}
        </option>
      ))}
    </select>
  );
}

function TextSelect({ name, options, current }: { name: string; options?: string[]; current: string | null }) {
  if (!options?.length) {
    return <p className="whitespace-pre-line text-[11px] leading-snug text-muted">{current ?? "—"}</p>;
  }
  return (
    <select name={name} defaultValue={current ?? undefined} className={cellInput}>
      {options.map((value) => (
        <option key={value} value={value}>
          {value.replace(/\n/g, " ")}
        </option>
      ))}
    </select>
  );
}

/** Deducible parcial: lista simple o armado en 3 partes (% VS, % VA, mínimo) como Sweaden/Alianza/Generali. */
function PartialDeductible({ column }: { column: ConfigurationColumn }) {
  const parts = column.options.partialDeductibleParts;
  const current = column.settings.partialDeductible ?? "";
  if (!parts) {
    return <TextSelect name={`partial:${column.insurerId}`} options={column.options.partialDeductible} current={current} />;
  }
  const vs = parts.vs.find((v) => current.startsWith(v)) ?? parts.vs[0];
  const rest = current.slice(vs.length);
  const va = parts.va.find((v) => rest.startsWith(v)) ?? parts.va[0];
  const min = parts.min.find((v) => rest.slice(va.length) === v) ?? parts.min[0];
  return (
    <div className="flex flex-col gap-1">
      {(
        [
          ["partialVs", parts.vs, vs],
          ["partialVa", parts.va, va],
          ["partialMin", parts.min, min],
        ] as const
      ).map(([field, values, selected]) => (
        <select key={field} name={`${field}:${column.insurerId}`} defaultValue={selected} className={cellInput}>
          {values.map((v) => (
            <option key={v} value={v}>
              {v.replace(/^\*\s*/, "").replace(/,\s*$/, "").replace(/,(?=\S)/g, ", ")}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}
