"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/actions/password.actions";
import type { ActionResult } from "@/actions/quote.actions";

const initial: ActionResult | null = null;

/** Mensaje de éxito siempre igual, exista o no la cuenta — ver password.actions.ts. */
export function RequestPasswordResetForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initial);

  if (state?.ok) {
    return (
      <p className="rounded-lg border border-green-900/40 bg-green-950/30 px-3 py-2 text-sm text-green-400">
        Si ese correo tiene una cuenta, te llega un link para crear una clave nueva.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <label className="text-xs font-semibold text-muted" htmlFor="email">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        {state?.ok === false && "email" in state.errors && (
          <p className="mt-1 text-xs text-red-500">{state.errors.email?.[0]}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-delta-navy px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Mandar link"}
      </button>
    </form>
  );
}
