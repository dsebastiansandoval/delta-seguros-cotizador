"use client";

import { useActionState } from "react";
import { setManualPremium, type ActionResult } from "@/actions/quote.actions";

export function ManualPremiumForm({
  quoteOptionId,
  quoteId,
}: {
  quoteOptionId: string;
  quoteId: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    setManualPremium,
    null,
  );

  return (
    <form action={formAction} className="flex items-center justify-end gap-2">
      <input type="hidden" name="quoteOptionId" value={quoteOptionId} />
      <input type="hidden" name="quoteId" value={quoteId} />
      <input
        name="netPremiumDollars"
        type="number"
        step="0.01"
        min="0"
        placeholder="Prima neta USD"
        required
        className="w-28 rounded-md border border-border bg-surface px-2 py-1 text-right text-xs"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-delta-navy px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending ? "…" : "Guardar"}
      </button>
      {state?.ok === false && (
        <span className="text-xs text-red-600">
          {"form" in state.errors ? state.errors.form[0] : state.errors.netPremiumDollars?.[0]}
        </span>
      )}
    </form>
  );
}
