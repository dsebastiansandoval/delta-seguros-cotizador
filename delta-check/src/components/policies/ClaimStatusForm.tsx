"use client";

import { useActionState } from "react";
import { updateClaimStatus } from "@/actions/claim.actions";
import type { ActionResult } from "@/actions/quote.actions";
import { CLAIM_STATUSES, CLAIM_STATUS_LABEL } from "@/domains/policies/claim-status-labels";

const initial: ActionResult | null = null;

export function ClaimStatusForm({ claimId, status }: { claimId: string; status: string }) {
  const [, formAction, pending] = useActionState(updateClaimStatus, initial);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="claimId" value={claimId} />
      <select
        key={status}
        name="status"
        defaultValue={status}
        className="min-w-0 max-w-full rounded-md border border-border bg-surface px-2 py-1 text-xs"
      >
        {CLAIM_STATUSES.map((s) => (
          <option key={s} value={s}>
            {CLAIM_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
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
