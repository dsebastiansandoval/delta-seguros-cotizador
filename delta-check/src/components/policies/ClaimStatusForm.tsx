"use client";

import { useActionState } from "react";
import { updateClaimStatus } from "@/actions/claim.actions";
import type { ActionResult } from "@/actions/quote.actions";

const initial: ActionResult | null = null;
const STATUSES = ["REPORTADO", "APROBADO", "REPARADO"] as const;

export function ClaimStatusForm({ claimId, status }: { claimId: string; status: string }) {
  const [, formAction, pending] = useActionState(updateClaimStatus, initial);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="claimId" value={claimId} />
      <select
        name="status"
        defaultValue={status}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-delta-navy px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending ? "…" : "Actualizar"}
      </button>
    </form>
  );
}
