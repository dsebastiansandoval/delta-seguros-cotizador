"use client";

import { useActionState, useState } from "react";
import { updateHealthQuoteClientInfo } from "@/actions/health-quote.actions";
import type { ActionResult } from "@/actions/quote.actions";

const initial: ActionResult<{ quoteId: string }> | null = null;

type Client = {
  documentType: string;
  documentNumber: string;
  firstName: string | null;
  lastName: string | null;
};

type Titular = { age: number; gender: "MASCULINO" | "FEMENINO"; birthDate: string | null };

function FieldError({ errors, name }: { errors: Extract<ActionResult, { ok: false }>["errors"] | undefined; name: string }) {
  if (!errors || "form" in errors) return null;
  const fieldErrors = errors[name];
  if (!fieldErrors?.length) return null;
  return <p className="text-xs text-red-600">{fieldErrors[0]}</p>;
}

/**
 * Corrige nombre/apellido y, a pedido explícito de Delta, también edad y
 * género del titular — aunque la cotización ya se haya enviado. Si edad
 * o género cambian, el servidor recalcula la comparativa entera (ver
 * updateHealthQuoteClientInfo en health-quote.actions.ts); por eso el
 * aviso debajo del campo. Arranca mostrando fecha de nacimiento si ya
 * había una guardada, o edad directa si no (mismo dato, misma forma que
 * se cargó originalmente).
 */
export function EditHealthClientForm({ quoteId, client, titular }: { quoteId: string; client: Client; titular: Titular | null }) {
  const [state, formAction, pending] = useActionState(updateHealthQuoteClientInfo, initial);
  const errors = state?.ok === false ? state.errors : undefined;
  const [useAge, setUseAge] = useState(!titular?.birthDate);

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

      {titular && (
        <div className="rounded-lg border border-border p-4">
          <p className="mb-3 text-xs text-muted">
            Edad y género son el factor con el que se calculó la prima — si los cambias, se recalcula toda la
            comparativa con los valores nuevos.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex items-center justify-between">
                <span>{useAge ? "Edad del titular" : "Fecha de nacimiento del titular"}</span>
                <label className="flex items-center gap-1.5 text-xs font-normal text-muted">
                  <input type="checkbox" checked={useAge} onChange={(e) => setUseAge(e.target.checked)} />
                  Edad
                </label>
              </div>
              {useAge ? (
                <input
                  name="titularAgeInput"
                  type="number"
                  min={0}
                  max={120}
                  defaultValue={titular.age}
                  className="rounded-lg border border-border bg-surface px-3 py-2"
                />
              ) : (
                <input
                  name="titularBirthDate"
                  type="date"
                  defaultValue={titular.birthDate ?? ""}
                  className="rounded-lg border border-border bg-surface px-3 py-2"
                />
              )}
              <FieldError errors={errors} name="titularBirthDate" />
            </div>
            <label className="flex flex-col gap-1 text-sm">
              Género
              <select name="titularGender" defaultValue={titular.gender} className="rounded-lg border border-border bg-surface px-3 py-2">
                <option value="MASCULINO">Masculino</option>
                <option value="FEMENINO">Femenino</option>
              </select>
            </label>
          </div>
        </div>
      )}

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
