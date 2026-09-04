"use client";

import { useActionState } from "react";
import { createArcoRequest } from "@/actions/arco.actions";
import type { ActionResult } from "@/actions/quote.actions";

const initialState: ActionResult | null = null;

export function ArcoRequestForm() {
  const [state, formAction, pending] = useActionState(createArcoRequest, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Documento del titular
        <input name="documentNumber" required className="rounded-lg border border-border bg-background px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Tipo de solicitud
        <select name="type" defaultValue="ACCESO" className="rounded-lg border border-border bg-background px-3 py-2">
          <option value="ACCESO">Acceso — ver qué datos tenemos de él/ella</option>
          <option value="RECTIFICACION">Rectificación — corregir un dato</option>
          <option value="CANCELACION">Cancelación — eliminar/anonimizar sus datos</option>
          <option value="OPOSICION">Oposición — no recibir comunicaciones</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Canal — cómo llegó el pedido
        <input name="channel" placeholder="Email, teléfono, presencial…" className="rounded-lg border border-border bg-background px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Notas
        <textarea name="notes" rows={3} className="rounded-lg border border-border bg-background px-3 py-2" />
      </label>

      {state?.ok === false && "form" in state.errors && (
        <p className="text-sm text-red-600">{state.errors.form[0]}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Registrando…" : "Registrar solicitud"}
      </button>
    </form>
  );
}
