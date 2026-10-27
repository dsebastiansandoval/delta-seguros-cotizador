"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword } from "@/actions/password.actions";
import type { ActionResult } from "@/actions/quote.actions";

const initial: ActionResult | null = null;

function fieldError(state: ActionResult | null, field: string): string | undefined {
  if (!state || state.ok) return undefined;
  const errors = state.errors as Record<string, string[]>;
  return errors[field]?.[0];
}

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex max-w-sm flex-col gap-3">
      <div>
        <label className="text-xs font-semibold text-muted" htmlFor="currentPassword">
          Clave actual
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        {fieldError(state, "currentPassword") && (
          <p className="mt-1 text-xs text-red-500">{fieldError(state, "currentPassword")}</p>
        )}
      </div>
      <div>
        <label className="text-xs font-semibold text-muted" htmlFor="newPassword">
          Clave nueva
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          minLength={8}
          required
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        {fieldError(state, "newPassword") && <p className="mt-1 text-xs text-red-500">{fieldError(state, "newPassword")}</p>}
      </div>
      <div>
        <label className="text-xs font-semibold text-muted" htmlFor="confirmPassword">
          Repetir clave nueva
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          minLength={8}
          required
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        {fieldError(state, "confirmPassword") && (
          <p className="mt-1 text-xs text-red-500">{fieldError(state, "confirmPassword")}</p>
        )}
      </div>
      {state?.ok === false && "form" in state.errors && (
        <p className="text-sm text-red-500">{state.errors.form?.[0]}</p>
      )}
      {state?.ok === true && <p className="text-sm text-green-500">Clave actualizada.</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-delta-navy px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Cambiar clave"}
      </button>
    </form>
  );
}
