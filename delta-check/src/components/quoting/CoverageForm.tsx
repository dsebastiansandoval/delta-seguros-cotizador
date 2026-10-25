"use client";

import { useActionState } from "react";
import { saveQuoteOptionCoverages } from "@/actions/quote-coverage.actions";
import type { ActionResult } from "@/actions/quote.actions";
import type { CoverageRow } from "@/domains/quoting/services/quote-coverage.service";
import { centsToDollars } from "@/domains/shared/money";

const initialState: ActionResult | null = null;

/**
 * Grilla "Sí otorga"/montos por aseguradora (ítem 8 del feedback,
 * ARCHITECTURE.md §30) — una fila por cada una de las 18 coberturas reales
 * (EXCEL-AUDIT.md, PDF de ejemplo real). El campo cambia según el tipo real
 * de la cobertura: checkbox para las que son sí/no, monto en dólares para
 * RC/AP/GM, texto libre para el resto (auto sustituto, accesorios extras,
 * concesionarios, air-bag, licencia caducada — su "valor" real siempre fue
 * una frase, no un número).
 */
export function CoverageForm({ quoteOptionId, coverages }: { quoteOptionId: string; coverages: CoverageRow[] }) {
  const [state, formAction, pending] = useActionState(saveQuoteOptionCoverages, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="quoteOptionId" value={quoteOptionId} />

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Cobertura</th>
              <th className="px-4 py-3">Valor</th>
            </tr>
          </thead>
          <tbody>
            {coverages.map((c) => (
              <tr key={c.coverageId} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">
                  {c.valueType === "BOOLEAN" && (
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name={`granted_${c.coverageId}`} defaultChecked={c.granted} />
                      Sí otorga
                    </label>
                  )}
                  {c.valueType === "AMOUNT" && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name={`amount_${c.coverageId}`}
                        defaultValue={c.amountCents != null ? centsToDollars(c.amountCents) : ""}
                        placeholder="0.00"
                        className="w-32 rounded-md border border-border bg-surface px-2 py-1"
                      />
                    </div>
                  )}
                  {c.valueType === "TEXT" && (
                    <input
                      type="text"
                      name={`text_${c.coverageId}`}
                      defaultValue={c.textValue ?? ""}
                      placeholder="Ej. 2 años, No otorga, 30 días…"
                      className="w-full max-w-sm rounded-md border border-border bg-surface px-2 py-1"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar coberturas"}
        </button>
        {state?.ok === true && <span className="text-sm font-semibold text-good">Guardado.</span>}
        {state?.ok === false && "form" in state.errors && (
          <span className="text-sm text-bad">{state.errors.form[0]}</span>
        )}
      </div>
    </form>
  );
}
