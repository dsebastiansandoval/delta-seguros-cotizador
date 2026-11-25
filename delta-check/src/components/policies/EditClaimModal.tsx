"use client";

import { useActionState, useEffect, useRef } from "react";
import { updateClaimDetails } from "@/actions/claim.actions";
import type { ActionResult } from "@/actions/quote.actions";
import { centsToDollars } from "@/domains/shared/money";

const initial: ActionResult | null = null;

type ClaimForEdit = {
  id: string;
  claimNumber: string | null;
  occurredAt: string | null;
  reportedAt: string | null;
  description: string | null;
  workshop: string | null;
  advisorName: string | null;
  contactPhone: string | null;
  hasThirdPartyLiability: boolean;
  thirdPartyPlate: string | null;
  claimValueCents: number | null;
  thirdPartyValueCents: number | null;
  deductibleAppliedCents: number | null;
};

/**
 * Pop-up de edición del siniestro completo (Valor, Vehículo, Taller y el
 * resto) — pedido 25-nov tras agregar edición solo de Taller: Fernando
 * quería también Valor y Vehículo, y de una vista completa en vez de
 * controles sueltos. El vehículo solo se edita acá cuando el siniestro es
 * standalone (`isStandalone`) — si viene de una póliza, su vehículo real
 * vive en `vehicles` vía la póliza/cotización, no en `claims`.
 */
export function EditClaimModal({
  claim,
  isStandalone,
  vehicle,
}: {
  claim: ClaimForEdit;
  isStandalone: boolean;
  vehicle: { plate: string | null; brand: string | null; model: string | null; year: number | null; color: string | null };
}) {
  const [state, formAction, pending] = useActionState(updateClaimDetails, initial);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (state?.ok === true) dialogRef.current?.close();
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-background"
      >
        Editar siniestro
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-2xl rounded-xl border border-border bg-surface p-0 shadow-lg backdrop:bg-black/40"
      >
        <form action={formAction} className="flex max-h-[85vh] flex-col">
          <input type="hidden" name="claimId" value={claim.id} />

          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide">Editar siniestro</h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="text-sm text-muted hover:text-foreground"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm">
                N° de siniestro
                <input
                  name="claimNumber"
                  defaultValue={claim.claimNumber ?? ""}
                  className="rounded-lg border border-border bg-surface px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Valor del siniestro (USD)
                <input
                  name="claimValueDollars"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={claim.claimValueCents != null ? centsToDollars(claim.claimValueCents) : ""}
                  className="rounded-lg border border-border bg-surface px-3 py-2"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm">
                Fecha del siniestro
                <input
                  type="date"
                  name="occurredAt"
                  defaultValue={claim.occurredAt ?? ""}
                  className="rounded-lg border border-border bg-surface px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Fecha de reporte
                <input
                  type="date"
                  name="reportedAt"
                  defaultValue={claim.reportedAt ?? ""}
                  className="rounded-lg border border-border bg-surface px-3 py-2"
                />
              </label>
            </div>

            {isStandalone && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Vehículo</p>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1 text-sm">
                    Placa
                    <input
                      name="vehiclePlate"
                      defaultValue={vehicle.plate ?? ""}
                      className="rounded-lg border border-border bg-surface px-3 py-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Marca
                    <input
                      name="vehicleBrand"
                      defaultValue={vehicle.brand ?? ""}
                      className="rounded-lg border border-border bg-surface px-3 py-2"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <label className="flex flex-col gap-1 text-sm">
                    Modelo
                    <input
                      name="vehicleModel"
                      defaultValue={vehicle.model ?? ""}
                      className="rounded-lg border border-border bg-surface px-3 py-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Año
                    <input
                      name="vehicleYear"
                      type="number"
                      defaultValue={vehicle.year ?? ""}
                      className="rounded-lg border border-border bg-surface px-3 py-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Color
                    <input
                      name="vehicleColor"
                      defaultValue={vehicle.color ?? ""}
                      className="rounded-lg border border-border bg-surface px-3 py-2"
                    />
                  </label>
                </div>
              </>
            )}

            <label className="flex flex-col gap-1 text-sm">
              Descripción
              <textarea
                name="description"
                rows={3}
                defaultValue={claim.description ?? ""}
                className="rounded-lg border border-border bg-surface px-3 py-2"
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm">
                Taller
                <input
                  name="workshop"
                  defaultValue={claim.workshop ?? ""}
                  className="rounded-lg border border-border bg-surface px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Asesor
                <input
                  name="advisorName"
                  defaultValue={claim.advisorName ?? ""}
                  className="rounded-lg border border-border bg-surface px-3 py-2"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              Contacto
              <input
                name="contactPhone"
                defaultValue={claim.contactPhone ?? ""}
                className="rounded-lg border border-border bg-surface px-3 py-2"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="hasThirdPartyLiability" defaultChecked={claim.hasThirdPartyLiability} />
              Involucra RC (responsabilidad civil a terceros)
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm">
                Placa del tercero (RC)
                <input
                  name="thirdPartyPlate"
                  defaultValue={claim.thirdPartyPlate ?? ""}
                  className="rounded-lg border border-border bg-surface px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Valor del tercero — RC (USD)
                <input
                  name="thirdPartyValueDollars"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={claim.thirdPartyValueCents != null ? centsToDollars(claim.thirdPartyValueCents) : ""}
                  className="rounded-lg border border-border bg-surface px-3 py-2"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              Deducible aplicado (USD)
              <input
                name="deductibleAppliedDollars"
                type="number"
                step="0.01"
                min="0"
                defaultValue={claim.deductibleAppliedCents != null ? centsToDollars(claim.deductibleAppliedCents) : ""}
                className="rounded-lg border border-border bg-surface px-3 py-2"
              />
            </label>

            {state?.ok === false && "form" in state.errors && (
              <p className="text-sm text-red-600">{state.errors.form[0]}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
