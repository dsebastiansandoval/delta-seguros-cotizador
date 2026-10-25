"use client";

import { useActionState } from "react";
import { emitPolicy } from "@/actions/policy.actions";
import type { ActionResult } from "@/actions/quote.actions";

const initialState: ActionResult | null = null;

export function EmitPolicyForm({ quoteOptionId }: { quoteOptionId: string }) {
  const [state, formAction, pending] = useActionState(emitPolicy, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="quoteOptionId" value={quoteOptionId} />

      <label className="flex flex-col gap-1 text-sm">
        Número de póliza (POLIZA) — dejalo vacío si la aseguradora todavía no lo asigna
        <input
          name="policyNumber"
          className="rounded-lg border border-border bg-surface px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Anexo
          <input name="annexNumber" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Factura
          <input name="invoiceNumber" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Vigencia desde
          <input type="date" name="startsAt" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Vigencia hasta
          <input type="date" name="endsAt" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="inspectionRequired" />
        Requiere inspección
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Observaciones
        <textarea name="notes" rows={2} className="rounded-lg border border-border bg-surface px-3 py-2" />
      </label>

      {state?.ok === false && "form" in state.errors && (
        <p className="text-sm text-red-600">{state.errors.form[0]}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Emitiendo…" : "Emitir póliza"}
      </button>
    </form>
  );
}
