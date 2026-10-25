"use client";

import { useActionState } from "react";
import { reportClaim } from "@/actions/claim.actions";
import type { ActionResult } from "@/actions/quote.actions";

const initial: ActionResult | null = null;

export function ReportClaimForm({ policyId }: { policyId: string }) {
  const [state, formAction, pending] = useActionState(reportClaim, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="policyId" value={policyId} />

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Fecha del siniestro
          <input type="date" name="occurredAt" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Fecha de reporte
          <input type="date" name="reportedAt" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Descripción
        <textarea name="description" rows={3} className="rounded-lg border border-border bg-surface px-3 py-2" />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Taller
          <input name="workshop" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Asesor
          <input name="advisorName" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Contacto
        <input name="contactPhone" className="rounded-lg border border-border bg-surface px-3 py-2" />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="hasThirdPartyLiability" />
        Involucra RC (responsabilidad civil a terceros)
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Placa del tercero (RC)
          <input name="thirdPartyPlate" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Valor estimado del siniestro (USD)
          <input name="claimValueDollars" type="number" step="0.01" min="0" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Valor del tercero — RC (USD)
          <input name="thirdPartyValueDollars" type="number" step="0.01" min="0" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Deducible aplicado (USD)
          <input name="deductibleAppliedDollars" type="number" step="0.01" min="0" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
      </div>

      {state?.ok === false && "form" in state.errors && (
        <p className="text-sm text-red-600">{state.errors.form[0]}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Reportando…" : "Reportar siniestro"}
      </button>
    </form>
  );
}
