"use client";

import { useActionState } from "react";
import {
  cancelPolicy,
  generateInstallments,
  markInstallmentPaid,
  markPolicyPaid,
  setPolicyNumber,
} from "@/actions/policy.actions";
import { setCommissionPercent, markCommissionPaid } from "@/actions/commission.actions";
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

export function CancelPolicyForm({ policyId }: { policyId: string }) {
  const [state, formAction, pending] = useActionState(cancelPolicy, initial);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="policyId" value={policyId} />
      <input
        name="cancellationReason"
        placeholder="Motivo de cancelación"
        required
        className="w-56 rounded-md border border-border bg-surface px-2 py-1 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending ? "…" : "Cancelar póliza"}
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
