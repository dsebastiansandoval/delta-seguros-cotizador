"use client";

import { useActionState, useState } from "react";
import { resetEngineRates, saveEngineRates } from "@/actions/settings.actions";
import {
  CONDOR_YEAR_COLUMNS,
  ENGINE_BODY_TYPES,
  type EngineBodyType,
  type EngineRates,
} from "@/domains/quoting/offer/excel-rates";
import { engineRatesSchema, firstIssue } from "@/domains/quoting/schemas/engine-rates.schema";

// El editor trabaja con texto (se puede tipear "3,4" a medias) y convierte al guardar.
type Draft = {
  latina: Record<EngineBodyType, { from: string; rate: string }[]>;
  soloPt: string;
  condor: Record<EngineBodyType, { from: string; to: string; rates: string[] }[]>;
  minPremium: string;
};

const BODY_LABELS: Record<EngineBodyType, string> = { LIVIANO: "Liviano", PICKUP: "Pickup" };
const YEARS = Array.from({ length: CONDOR_YEAR_COLUMNS }, (_, i) => i);

const cell = "w-full min-w-0 rounded border border-border bg-surface px-1.5 py-0.5 text-right text-xs tabular-nums";
const removeClass = "px-1 text-xs text-muted hover:text-bad";
const addClass = "mt-1 text-xs font-semibold text-link hover:underline";

const pct = (rate: number) => String(Number((rate * 100).toFixed(4))).replace(".", ",");
const money = (n: number) => String(n).replace(".", ",");
const num = (s: string) => {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  return t === "" ? null : Number(t);
};
const fromPct = (s: string) => {
  const n = num(s);
  return n == null ? null : Number((n / 100).toFixed(6));
};

function toDraft(rates: EngineRates): Draft {
  const map = <U,>(f: (b: EngineBodyType) => U) =>
    Object.fromEntries(ENGINE_BODY_TYPES.map((b) => [b, f(b)])) as Record<EngineBodyType, U>;
  return {
    latina: map((b) => rates.latina.todoRiesgo[b].map((x) => ({ from: money(x.from), rate: pct(x.rate) }))),
    soloPt: pct(rates.latina.soloPerdidaTotalRate),
    condor: map((b) =>
      rates.condor.bands[b].map((x) => ({
        from: money(x.from),
        to: money(x.to),
        rates: x.rates.map((r) => (r == null ? "" : pct(r))),
      })),
    ),
    minPremium: money(rates.condor.minPremiumCents / 100),
  };
}

function fromDraft(d: Draft): unknown {
  const map = <U,>(f: (b: EngineBodyType) => U) => Object.fromEntries(ENGINE_BODY_TYPES.map((b) => [b, f(b)]));
  return {
    latina: {
      todoRiesgo: map((b) => d.latina[b].map((x) => ({ from: num(x.from), rate: fromPct(x.rate) }))),
      soloPerdidaTotalRate: fromPct(d.soloPt),
    },
    condor: {
      bands: map((b) => d.condor[b].map((x) => ({ from: num(x.from), to: num(x.to), rates: x.rates.map(fromPct) }))),
      minPremiumCents: Math.round((num(d.minPremium) ?? NaN) * 100),
    },
  };
}

export function EngineRatesEditor({
  rates,
  customized,
  updatedAt,
}: {
  rates: EngineRates;
  customized: boolean;
  updatedAt: Date | null;
}) {
  const [state, formAction, pending] = useActionState(saveEngineRates, null);
  const [draft, setDraft] = useState(() => toDraft(rates));
  const [clientError, setClientError] = useState<string | null>(null);
  // Si el servidor trae otras tablas (guardado o restaurado), el borrador se reinicia.
  const [source, setSource] = useState(rates);
  if (source !== rates) {
    setSource(rates);
    setDraft(toDraft(rates));
  }

  const update = (f: (d: Draft) => void) =>
    setDraft((d) => {
      const next = structuredClone(d);
      f(next);
      return next;
    });

  const parsed = engineRatesSchema.safeParse(fromDraft(draft));
  const serverError = state?.ok === false ? Object.values(state.errors).flat()[0] : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted">
        {customized
          ? `Tablas propias de Delta${updatedAt ? `, actualizadas el ${updatedAt.toLocaleDateString("es-EC")}` : ""}.`
          : "Usando las tablas del Excel (INFO GENERAL)."}{" "}
        Los cambios aplican a las cotizaciones nuevas y a las que se reconfiguren; las ya generadas conservan su prima.
      </p>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h3 className="text-sm font-semibold">Latina</h3>
        <p className="mt-0.5 text-xs text-muted">
          Todo riesgo: tasa según valor asegurado (casco + extras), vehículos de hasta 10 años. Cada tramo rige desde su
          valor hasta el siguiente.
        </p>
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          {ENGINE_BODY_TYPES.map((body) => (
            <div key={body}>
              <table className="w-full text-xs">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="pb-1 font-semibold">{BODY_LABELS[body]} · desde $</th>
                    <th className="pb-1 font-semibold">Tasa %</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {draft.latina[body].map((row, i) => (
                    <tr key={i}>
                      <td className="py-0.5 pr-2">
                        <input
                          value={row.from}
                          onChange={(e) => update((d) => void (d.latina[body][i].from = e.target.value))}
                          aria-label={`Latina ${body} tramo ${i + 1} desde`}
                          className={cell}
                        />
                      </td>
                      <td className="py-0.5 pr-2">
                        <input
                          value={row.rate}
                          onChange={(e) => update((d) => void (d.latina[body][i].rate = e.target.value))}
                          aria-label={`Latina ${body} tramo ${i + 1} tasa`}
                          className={cell}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => update((d) => void d.latina[body].splice(i, 1))}
                          aria-label="Quitar tramo"
                          className={removeClass}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                onClick={() => update((d) => void d.latina[body].push({ from: "", rate: "" }))}
                className={addClass}
              >
                + Tramo
              </button>
            </div>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-2 text-xs">
          Solo pérdida total (hasta 13 años), tasa %
          <input
            value={draft.soloPt}
            onChange={(e) => update((d) => void (d.soloPt = e.target.value))}
            className={`${cell} !w-20`}
          />
        </label>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h3 className="text-sm font-semibold">Cóndor</h3>
        <p className="mt-0.5 text-xs text-muted">
          Tasa % según casco y años de uso (vehículo del año = 1). Celda vacía = no se asegura. Si dos tramos se
          superponen, gana el de más arriba, como en el Excel.
        </p>
        {ENGINE_BODY_TYPES.map((body) => (
          <div key={body} className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="w-20 pb-1 text-left font-semibold">{BODY_LABELS[body]} · desde $</th>
                  <th className="w-20 pb-1 text-left font-semibold">hasta $</th>
                  {YEARS.map((y) => (
                    <th key={y} className="pb-1 font-semibold">
                      {y}
                    </th>
                  ))}
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {draft.condor[body].map((band, i) => (
                  <tr key={i}>
                    <td className="py-0.5 pr-1">
                      <input
                        value={band.from}
                        onChange={(e) => update((d) => void (d.condor[body][i].from = e.target.value))}
                        aria-label={`Cóndor ${body} tramo ${i + 1} desde`}
                        className={cell}
                      />
                    </td>
                    <td className="py-0.5 pr-1">
                      <input
                        value={band.to}
                        onChange={(e) => update((d) => void (d.condor[body][i].to = e.target.value))}
                        aria-label={`Cóndor ${body} tramo ${i + 1} hasta`}
                        className={cell}
                      />
                    </td>
                    {YEARS.map((y) => (
                      <td key={y} className="px-0.5 py-0.5">
                        <input
                          value={band.rates[y]}
                          onChange={(e) => update((d) => void (d.condor[body][i].rates[y] = e.target.value))}
                          aria-label={`Cóndor ${body} tramo ${i + 1} año ${y}`}
                          className={cell}
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        onClick={() => update((d) => void d.condor[body].splice(i, 1))}
                        aria-label="Quitar tramo"
                        className={removeClass}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              onClick={() =>
                update((d) => void d.condor[body].push({ from: "", to: "", rates: Array(CONDOR_YEAR_COLUMNS).fill("") }))
              }
              className={addClass}
            >
              + Tramo
            </button>
          </div>
        ))}
        <label className="mt-4 flex items-center gap-2 text-xs">
          Prima neta mínima $
          <input
            value={draft.minPremium}
            onChange={(e) => update((d) => void (d.minPremium = e.target.value))}
            className={`${cell} !w-24`}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form
          action={formAction}
          onSubmit={(e) => {
            if (!parsed.success) {
              e.preventDefault();
              setClientError(firstIssue(parsed.error));
            } else {
              setClientError(null);
            }
          }}
        >
          <input type="hidden" name="rates" value={JSON.stringify(parsed.success ? parsed.data : null)} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-delta-navy px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar tasas"}
          </button>
        </form>
        {customized && (
          <form action={resetEngineRates}>
            <button type="submit" className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">
              Volver a las tasas del Excel
            </button>
          </form>
        )}
        {state?.ok === true && customized && <span className="text-sm font-semibold text-good">Tasas guardadas.</span>}
        {(clientError ?? serverError) && <span className="text-xs text-bad">{clientError ?? serverError}</span>}
      </div>
    </div>
  );
}
