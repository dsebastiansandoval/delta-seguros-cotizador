"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { setPassword } from "@/actions/password.actions";
import type { ActionResult } from "@/actions/quote.actions";

const initial: ActionResult | null = null;

function fieldError(state: ActionResult | null, field: string): string | undefined {
  if (!state || state.ok) return undefined;
  const errors = state.errors as Record<string, string[]>;
  return errors[field]?.[0];
}

/** Destino del link de "crear clave" (invitación) y "recuperar clave" — mismo formulario para los dos casos. */
export function SetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(setPassword, initial);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(() => router.push("/login"), 2000);
      return () => clearTimeout(t);
    }
  }, [state, router]);

  if (state?.ok) {
    return (
      <p className="rounded-lg border border-green-900/40 bg-green-950/30 px-3 py-2 text-sm text-green-400">
        Clave creada — ya podés iniciar sesión. Redirigiendo…
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="text-xs font-semibold text-muted" htmlFor="password">
          Clave nueva
        </label>
        <input
          id="password"
          name="password"
          type="password"
          minLength={8}
          required
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        {fieldError(state, "password") && <p className="mt-1 text-xs text-red-500">{fieldError(state, "password")}</p>}
      </div>
      <div>
        <label className="text-xs font-semibold text-muted" htmlFor="confirmPassword">
          Repetir clave
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
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-delta-navy px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Crear clave"}
      </button>
    </form>
  );
}
