"use client";

import { useActionState, useState, useTransition } from "react";
import {
  anonymizeClient,
  exportClientData,
  rectifyClient,
  setMarketingOptOut,
  updateArcoStatus,
} from "@/actions/arco.actions";
import type { ActionResult } from "@/actions/quote.actions";

const initial: ActionResult | null = null;

function ErrorText({ state }: { state: ActionResult | null }) {
  if (state?.ok === false && "form" in state.errors) {
    return <p className="text-xs text-red-600">{state.errors.form[0]}</p>;
  }
  return null;
}

/** Acceso — trae y muestra el dato crudo del titular (nunca resumido/transformado). */
export function ExportClientDataButton({ clientId }: { clientId: string }) {
  const [data, setData] = useState<unknown>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => startTransition(async () => setData(await exportClientData(clientId)))}
        disabled={pending}
        className="w-fit rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Generando…" : "Ver todos los datos del titular"}
      </button>
      {data != null && (
        <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-background p-4 text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function RectifyClientForm({
  requestId,
  clientId,
  current,
}: {
  requestId: string;
  clientId: string;
  current: { firstName: string | null; lastName: string | null; businessName: string | null; email: string | null; phone: string | null };
}) {
  const [state, formAction, pending] = useActionState(rectifyClient, initial);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="clientId" value={clientId} />

      <label className="flex flex-col gap-1 text-sm">
        Nombres
        <input name="firstName" defaultValue={current.firstName ?? ""} className="rounded-lg border border-border bg-surface px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Apellidos
        <input name="lastName" defaultValue={current.lastName ?? ""} className="rounded-lg border border-border bg-surface px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Razón social
        <input name="businessName" defaultValue={current.businessName ?? ""} className="rounded-lg border border-border bg-surface px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input name="email" type="email" defaultValue={current.email ?? ""} className="rounded-lg border border-border bg-surface px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Teléfono
        <input name="phone" defaultValue={current.phone ?? ""} className="rounded-lg border border-border bg-surface px-3 py-2" />
      </label>

      <div className="col-span-full">
        <ErrorText state={state} />
        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar corrección"}
        </button>
      </div>
    </form>
  );
}

export function AnonymizeClientForm({ requestId, clientId }: { requestId: string; clientId: string }) {
  const [state, formAction, pending] = useActionState(anonymizeClient, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="clientId" value={clientId} />
      <p className="text-sm text-muted">
        Redacta el contacto (email/teléfono) siempre. El nombre solo se anonimiza si el titular
        nunca tuvo una póliza — si tuvo alguna, queda como identificación legal del historial
        (obligación de conservación, LOPDP Art. 22).
      </p>
      <ErrorText state={state} />
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Anonimizando…" : "Anonimizar datos del titular"}
      </button>
    </form>
  );
}

export function MarketingOptOutForm({ requestId, clientId, current }: { requestId: string; clientId: string; current: boolean }) {
  const [state, formAction, pending] = useActionState(setMarketingOptOut, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="clientId" value={clientId} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="optOut" defaultChecked={current} />
        No enviar comunicaciones/marketing a este cliente
      </label>
      <ErrorText state={state} />
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar preferencia"}
      </button>
    </form>
  );
}

export function UpdateArcoStatusForm({ requestId, status }: { requestId: string; status: string }) {
  const [, formAction, pending] = useActionState(updateArcoStatus, initial);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <select name="status" defaultValue={status} className="rounded-md border border-border bg-surface px-2 py-1 text-sm">
        <option value="EN_PROCESO">En proceso</option>
        <option value="COMPLETADA">Completada</option>
        <option value="RECHAZADA">Rechazada</option>
      </select>
      <input
        name="resolutionNotes"
        placeholder="Notas de resolución (opcional)"
        className="w-56 rounded-md border border-border bg-surface px-2 py-1 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-delta-navy px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending ? "…" : "Actualizar estado"}
      </button>
    </form>
  );
}
