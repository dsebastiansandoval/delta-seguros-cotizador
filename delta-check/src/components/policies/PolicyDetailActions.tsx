"use client";

import { useActionState } from "react";
import {
  cancelPolicy,
  confirmCancellation,
  generateInstallments,
  markInstallmentPaid,
  markPolicyPaid,
  setIssueStatus,
  setPolicyNumber,
} from "@/actions/policy.actions";
import { setCommissionPercent, markCommissionDiscounted, markCommissionPaid } from "@/actions/commission.actions";
import type { ActionResult } from "@/actions/quote.actions";

const initial: ActionResult | null = null;

function ErrorText({ state }: { state: ActionResult | null }) {
  if (state?.ok === false && "form" in state.errors) {
    return <p className="text-xs text-red-600">{state.errors.form[0]}</p>;
  }
  return null;
}

export function SetPolicyNumberForm({ policyId }: { policyId: string }) {
  const [state, formAction, pending] = useActionState(setPolicyNumber, initial);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="policyId" value={policyId} />
      <input
        name="policyNumber"
        placeholder="Número de póliza"
        required
        className="w-40 rounded-md border border-border bg-surface px-2 py-1 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-delta-navy px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending ? "…" : "Asignar"}
      </button>
      <ErrorText state={state} />
    </form>
  );
}

export function MarkPolicyPaidButton({ policyId }: { policyId: string }) {
  const [state, formAction, pending] = useActionState(markPolicyPaid, initial);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="policyId" value={policyId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending ? "…" : "Marcar pagada"}
      </button>
      <ErrorText state={state} />
    </form>
  );
}

/** Mismas opciones de ESTATUS que BASE EMISIONES; EMITIDA se marca al asignar el número de póliza. */
export function IssueStatusForm({ policyId, current }: { policyId: string; current: string }) {
  const [state, formAction, pending] = useActionState(setIssueStatus, initial);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="policyId" value={policyId} />
      <select
        name="issueStatus"
        defaultValue={current}
        aria-label="Estatus de emisión"
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
      >
        <option value="PENDIENTE">Pendiente</option>
        <option value="INSPECCION">Inspección</option>
        <option value="NO_EMITIDA">No emitida</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-border px-3 py-1 text-xs font-semibold disabled:opacity-60"
      >
        {pending ? "…" : "Cambiar estatus"}
      </button>
      <ErrorText state={state} />
    </form>
  );
}

/** BASE CANCELADAS: motivo, prima cancelada y si la aseguradora ya la confirmó (ESTATUS CANCELADA vs PENDIENTE). */
export function CancelPolicyForm({ policyId, premiumDollars }: { policyId: string; premiumDollars: number | null }) {
  const [state, formAction, pending] = useActionState(cancelPolicy, initial);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="policyId" value={policyId} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Motivo
          <input
            name="cancellationReason"
            placeholder="Motivo de cancelación"
            required
            className="w-56 rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Prima cancelada USD
          <input
            name="cancelledPremiumDollars"
            type="number"
            step="0.01"
            min="0"
            max={premiumDollars ?? undefined}
            defaultValue={premiumDollars ?? undefined}
            required
            className="w-32 rounded-md border border-border bg-surface px-2 py-1 text-right text-sm text-foreground"
          />
        </label>
        <label className="flex items-center gap-2 pb-1 text-sm">
          <input type="checkbox" name="confirmed" />
          Ya confirmada por la aseguradora
        </label>
      </div>
      <p className="text-xs text-muted">
        La comisión queda por descontar sobre la prima cancelada.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {pending ? "…" : "Cancelar póliza"}
        </button>
        <ErrorText state={state} />
      </div>
    </form>
  );
}

export function ConfirmCancellationButton({ policyId }: { policyId: string }) {
  const [state, formAction, pending] = useActionState(confirmCancellation, initial);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="policyId" value={policyId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending ? "…" : "Aseguradora confirmó la cancelación"}
      </button>
      <ErrorText state={state} />
    </form>
  );
}

export function GenerateInstallmentsForm({ policyId, premiumDollars }: { policyId: string; premiumDollars: number }) {
  const [state, formAction, pending] = useActionState(generateInstallments, initial);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="policyId" value={policyId} />
      <label className="text-xs text-muted">
        Cuotas
        <input
          name="count"
          type="number"
          min={1}
          max={12}
          defaultValue={12}
          required
          className="ml-1 w-14 rounded-md border border-border bg-surface px-2 py-1 text-sm"
        />
      </label>
      <label className="text-xs text-muted">
        Total USD
        <input
          name="totalDollars"
          type="number"
          step="0.01"
          min="0"
          defaultValue={premiumDollars}
          required
          className="ml-1 w-24 rounded-md border border-border bg-surface px-2 py-1 text-sm"
        />
      </label>
      <label className="text-xs text-muted">
        Primera cuota
        <input name="firstDueDate" type="date" className="ml-1 rounded-md border border-border bg-surface px-2 py-1 text-sm" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-delta-navy px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending ? "…" : "Generar cuotas"}
      </button>
      <ErrorText state={state} />
    </form>
  );
}

export function MarkInstallmentPaidButton({ installmentId, policyId }: { installmentId: string; policyId: string }) {
  const [, formAction, pending] = useActionState(markInstallmentPaid, initial);
  return (
    <form action={formAction}>
      <input type="hidden" name="installmentId" value={installmentId} />
      <input type="hidden" name="policyId" value={policyId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-green-700 px-2 py-0.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending ? "…" : "Marcar pagada"}
      </button>
    </form>
  );
}

export function SetCommissionForm({ commissionId }: { commissionId: string }) {
  const [state, formAction, pending] = useActionState(setCommissionPercent, initial);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="commissionId" value={commissionId} />
      <input
        name="percent"
        type="number"
        step="0.01"
        min="0"
        max="100"
        placeholder="% comisión"
        required
        className="w-24 rounded-md border border-border bg-surface px-2 py-1 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-delta-navy px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending ? "…" : "Guardar %"}
      </button>
      <ErrorText state={state} />
    </form>
  );
}

export function MarkCommissionPaidButton({ commissionId }: { commissionId: string }) {
  const [, formAction, pending] = useActionState(markCommissionPaid, initial);
  return (
    <form action={formAction}>
      <input type="hidden" name="commissionId" value={commissionId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-green-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending ? "…" : "Marcar comisionada"}
      </button>
    </form>
  );
}

export function MarkCommissionDiscountedButton({ commissionId, policyId }: { commissionId: string; policyId?: string }) {
  const [state, formAction, pending] = useActionState(markCommissionDiscounted, initial);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="commissionId" value={commissionId} />
      {policyId && <input type="hidden" name="policyId" value={policyId} />}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-border px-3 py-1 text-xs font-semibold disabled:opacity-60"
      >
        {pending ? "…" : "Marcar descontada"}
      </button>
      <ErrorText state={state} />
    </form>
  );
}
