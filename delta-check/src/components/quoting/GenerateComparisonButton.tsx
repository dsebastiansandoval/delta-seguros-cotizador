"use client";

import { useActionState } from "react";
import { runQuoteComparison, type ActionResult } from "@/actions/quote.actions";

export function GenerateComparisonButton({ quoteId }: { quoteId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(runQuoteComparison, null);
  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="quoteId" value={quoteId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Generando…" : "Generar comparativa →"}
      </button>
      {state?.ok === false && "form" in state.errors && <span className="text-sm text-bad">{state.errors.form[0]}</span>}
    </form>
  );
}
