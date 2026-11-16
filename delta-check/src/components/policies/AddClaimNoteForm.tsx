"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addClaimNote } from "@/actions/claim.actions";
import type { ActionResult } from "@/actions/quote.actions";

const initial: ActionResult | null = null;

/** El "chat" del siniestro — una novedad más al historial, nunca reemplaza las anteriores. */
export function AddClaimNoteForm({ claimId }: { claimId: string }) {
  const [state, formAction, pending] = useActionState(addClaimNote, initial);
  const formRef = useRef<HTMLFormElement>(null);
  // El botón avisa si va a notificar o no antes de enviar — el campo de
  // correo queda debajo del botón en el layout, así que esto no se nota
  // con solo mirar el formulario sin este estado.
  const [hasEmail, setHasEmail] = useState(false);
  // "Ajustar estado durante el render" en vez de un efecto (react.dev,
  // evita el setState-en-efecto) — apenas `state` cambia a un envío
  // exitoso, se nota en el mismo render y se apaga `hasEmail` ahí mismo.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state?.ok) setHasEmail(false);
  }

  // Limpiar el textarea/correo del DOM sí es un efecto legítimo (sincroniza
  // con el formulario real, no con estado de React) — solo cuando se guardó.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="claimId" value={claimId} />
      <div className="flex items-start gap-2">
        <textarea
          name="note"
          rows={2}
          placeholder="Escribe una novedad — queda en el historial con tu nombre y la hora"
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "…" : hasEmail ? "Agregar y Notificar" : "Agregar"}
        </button>
      </div>
      <input
        type="email"
        name="notifyEmail"
        placeholder="Notificar por correo a (opcional) — ej. cliente@correo.com"
        onChange={(e) => setHasEmail(e.target.value.trim() !== "")}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs"
      />
      {state?.ok === false && "note" in state.errors && (
        <p className="text-sm text-red-600">{state.errors.note?.[0]}</p>
      )}
      {state?.ok === false && "notifyEmail" in state.errors && (
        <p className="text-sm text-red-600">{state.errors.notifyEmail?.[0]}</p>
      )}
    </form>
  );
}
