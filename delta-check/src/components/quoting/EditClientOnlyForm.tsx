"use client";

import { useActionState } from "react";
import { updateQuoteClientInfo, type ActionResult } from "@/actions/quote.actions";

const initial: ActionResult<{ quoteId: string }> | null = null;

function FieldError({ errors, name }: { errors: Extract<ActionResult, { ok: false }>["errors"] | undefined; name: string }) {
  if (!errors || "form" in errors) return null;
  const fieldErrors = errors[name];
  if (!fieldErrors?.length) return null;
  return <p className="text-xs text-red-600">{fieldErrors[0]}</p>;
}

type Client = {
  personType: "NATURAL" | "JURIDICA";
  documentType: string;
  documentNumber: string;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  birthDate: string | null;
  maritalStatus: string | null;
  gender: string | null;
};

/**
 * Corrige solo los datos del cliente de una cotización ya enviada —
 * vehículo y precios no se muestran acá, se quedan fijos (ver
 * updateQuoteClientInfo en quote.actions.ts). Formulario chico y aparte
 * de NuevaCotizacionForm a propósito: no reutiliza sus refs/hooks de
 * vehículo, que acá no aplican.
 */
export function EditClientOnlyForm({ quoteId, client }: { quoteId: string; client: Client }) {
  const [state, formAction, pending] = useActionState(updateQuoteClientInfo, initial);
  const errors = state?.ok === false ? state.errors : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="personType" value={client.personType} />

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

      {client.personType === "NATURAL" ? (
        <>
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

          <label className="flex flex-col gap-1 text-sm">
            Fecha de nacimiento
            <input
              type="date"
              name="birthDate"
              defaultValue={client.birthDate ?? ""}
              className="rounded-lg border border-border bg-surface px-3 py-2"
            />
            <FieldError errors={errors} name="birthDate" />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Estado civil
              <select
                name="maritalStatus"
                defaultValue={client.maritalStatus ?? ""}
                className="rounded-lg border border-border bg-surface px-3 py-2"
              >
                <option value="">—</option>
                <option value="SOLTERO">Soltero/a</option>
                <option value="CASADO">Casado/a</option>
                <option value="DIVORCIADO">Divorciado/a</option>
                <option value="VIUDO">Viudo/a</option>
                <option value="UNION_DE_HECHO">Unión de hecho</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Género
              <select
                name="gender"
                defaultValue={client.gender ?? ""}
                className="rounded-lg border border-border bg-surface px-3 py-2"
              >
                <option value="">—</option>
                <option value="MASCULINO">Masculino</option>
                <option value="FEMENINO">Femenino</option>
              </select>
            </label>
          </div>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Razón social
            <input
              name="businessName"
              defaultValue={client.businessName ?? ""}
              className="rounded-lg border border-border bg-surface px-3 py-2"
            />
            <FieldError errors={errors} name="businessName" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Constitución
            <input
              type="date"
              name="birthDate"
              defaultValue={client.birthDate ?? ""}
              className="rounded-lg border border-border bg-surface px-3 py-2"
            />
            <FieldError errors={errors} name="birthDate" />
          </label>
        </>
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
