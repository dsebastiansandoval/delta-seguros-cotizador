"use client";

import { useActionState, useState } from "react";
import { reportClaim } from "@/actions/claim.actions";
import type { ActionResult } from "@/actions/quote.actions";

const initial: ActionResult | null = null;

type InsurerOption = { id: string; name: string };

function fieldError(state: ActionResult | null, field: string): string | undefined {
  return state?.ok === false && field in state.errors ? (state.errors as Record<string, string[]>)[field]?.[0] : undefined;
}

/**
 * Reportado desde Cartera (`linkedPolicy` dado): marca/aseguradora/cliente
 * salen de la póliza, solo se piden los datos propios del siniestro.
 * Reportado directo desde Siniestros (sin `linkedPolicy`): no hay póliza
 * que los traiga, así que se piden a mano — mismo criterio que BASE
 * SINIESTROS en el Excel, donde esas columnas son texto libre.
 */
export function ReportClaimForm({
  linkedPolicy,
  insurersByBranch,
}: {
  linkedPolicy?: { id: string; branch: "AUTOS" | "SALUD" };
  insurersByBranch?: Record<"AUTOS" | "SALUD", InsurerOption[]>;
}) {
  const [state, formAction, pending] = useActionState(reportClaim, initial);
  const [branch, setBranch] = useState<"AUTOS" | "SALUD">(linkedPolicy?.branch ?? "AUTOS");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {linkedPolicy ? (
        <>
          <input type="hidden" name="policyId" value={linkedPolicy.id} />
          <input type="hidden" name="branch" value={linkedPolicy.branch} />
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Ramo
            <select
              name="branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value as "AUTOS" | "SALUD")}
              className="rounded-lg border border-border bg-surface px-3 py-2"
            >
              <option value="AUTOS">Autos</option>
              <option value="SALUD">Salud AM</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Cliente
              <input name="clientName" className="rounded-lg border border-border bg-surface px-3 py-2" />
              {fieldError(state, "clientName") && <p className="text-xs text-red-600">{fieldError(state, "clientName")}</p>}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Cédula o RUC
              <input name="clientDocumentNumber" className="rounded-lg border border-border bg-surface px-3 py-2" />
              {fieldError(state, "clientDocumentNumber") && (
                <p className="text-xs text-red-600">{fieldError(state, "clientDocumentNumber")}</p>
              )}
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Aseguradora
              <select name="insurerId" defaultValue="" className="rounded-lg border border-border bg-surface px-3 py-2">
                <option value="" disabled>
                  Elige una
                </option>
                {(insurersByBranch?.[branch] ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              {fieldError(state, "insurerId") && <p className="text-xs text-red-600">{fieldError(state, "insurerId")}</p>}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              N° de póliza
              <input name="policyNumber" className="rounded-lg border border-border bg-surface px-3 py-2" />
            </label>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Fecha del siniestro
          <input type="date" name="occurredAt" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Fecha de reporte
          <input type="date" name="reportedAt" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Descripción
        <textarea name="description" rows={3} className="rounded-lg border border-border bg-surface px-3 py-2" />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Taller
          <input name="workshop" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Asesor
          <input name="advisorName" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Contacto
        <input name="contactPhone" className="rounded-lg border border-border bg-surface px-3 py-2" />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="hasThirdPartyLiability" />
        Involucra RC (responsabilidad civil a terceros)
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Placa del tercero (RC)
          <input name="thirdPartyPlate" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Valor estimado del siniestro (USD)
          <input name="claimValueDollars" type="number" step="0.01" min="0" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Valor del tercero — RC (USD)
          <input name="thirdPartyValueDollars" type="number" step="0.01" min="0" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Deducible aplicado (USD)
          <input name="deductibleAppliedDollars" type="number" step="0.01" min="0" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
      </div>

      {state?.ok === false && "form" in state.errors && (
        <p className="text-sm text-red-600">{state.errors.form[0]}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Reportando…" : "Reportar siniestro"}
      </button>
    </form>
  );
}
