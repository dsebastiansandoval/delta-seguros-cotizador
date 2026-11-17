"use client";

import { useActionState } from "react";
import { updateMyProfile } from "@/actions/user.actions";
import type { ActionResult } from "@/actions/quote.actions";

const initial: ActionResult | null = null;

export function UpdateNameForm({ fullName }: { fullName: string }) {
  const [state, formAction, pending] = useActionState(updateMyProfile, initial);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-3">
      <div>
        <label className="text-xs font-semibold text-muted" htmlFor="fullName">
          Nombre
        </label>
        <input
          id="fullName"
          name="fullName"
          defaultValue={fullName}
          required
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        {state?.ok === false && "fullName" in state.errors && (
          <p className="mt-1 text-xs text-red-500">{state.errors.fullName?.[0]}</p>
        )}
      </div>
      {state?.ok === true && <p className="text-sm text-green-500">Nombre actualizado.</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-delta-navy px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar nombre"}
      </button>
    </form>
  );
}
