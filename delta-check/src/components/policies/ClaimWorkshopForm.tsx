"use client";

import { useActionState } from "react";
import { updateClaimWorkshop } from "@/actions/claim.actions";
import type { ActionResult } from "@/actions/quote.actions";

const initial: ActionResult | null = null;

export function ClaimWorkshopForm({ claimId, workshop }: { claimId: string; workshop: string | null }) {
  const [, formAction, pending] = useActionState(updateClaimWorkshop, initial);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="claimId" value={claimId} />
      <input
        key={workshop}
        name="workshop"
        defaultValue={workshop ?? ""}
        placeholder="Sin taller asignado"
        className="min-w-0 max-w-full rounded-md border border-border bg-surface px-2 py-1 text-xs"
      />
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 rounded-md bg-delta-navy px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending ? "…" : "Actualizar"}
      </button>
    </form>
  );
}
