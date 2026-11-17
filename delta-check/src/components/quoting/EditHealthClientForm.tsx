"use client";

import { useActionState } from "react";
import { updateHealthQuoteClientInfo } from "@/actions/health-quote.actions";
import type { ActionResult } from "@/actions/quote.actions";

const initial: ActionResult<{ quoteId: string }> | null = null;

type Client = {
  documentType: string;
  documentNumber: string;
  firstName: string | null;
  lastName: string | null;
};

function FieldError({ errors, name }: { errors: Extract<ActionResult, { ok: false }>["errors"] | undefined; name: string }) {
  if (!errors || "form" in errors) return null;
  const fieldErrors = errors[name];
  if (!fieldErrors?.length) return null;
  return <p className="text-xs text-red-600">{fieldErrors[0]}</p>;
}

/**
 * Corrige solo nombre/apellido del titular de una cotización de Salud —
 * edad/género (el factor de tarifa) no se muestran ni se tocan acá, ver
 * updateHealthQuoteClientInfo en health-quote.actions.ts.
 */
export function EditHealthClientForm({ quoteId, client }: { quoteId: string; client: Client }) {
  const [state, formAction, pending] = useActionState(updateHealthQuoteClientInfo, initial);
  const errors = state?.ok === false ? state.errors : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="quoteId" value={quoteId} />

      {state?.ok && (
        <p className="rounded-lg border border-green-900/40 bg-green-950/30 px-3 py-2 text-sm text-green-400">
          Datos del cliente actualizados.
        </p>
      )}
      {errors && "form" in errors && errors.form && (
        <p className="rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-400">
          {errors.form[0]}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        {client.documentType === "RUC" ? "RUC" : client.documentType === "PASAPORTE" ? "Pasaporte" : "Cédula"}
        <input readOnly value={client.documentNumber} className="rounded-lg border border-border bg-surface px-3 py-2 text-muted" />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Nombres
          <input
            name="firstName"
            defaultValue={client.firstName ?? ""}
            className="rounded-lg border border-border bg-surface px-3 py-2"
          />
          <FieldError errors={errors} name="firstName" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Apellidos
          <input
            name="lastName"
            defaultValue={client.lastName ?? ""}
            className="rounded-lg border border-border bg-surface px-3 py-2"
          />
          <FieldError errors={errors} name="lastName" />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-delta-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar cambios del cliente"}
      </button>
    </form>
  );
}
