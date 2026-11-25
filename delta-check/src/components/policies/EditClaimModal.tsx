"use client";

import { useActionState, useEffect, useRef } from "react";
import { updateClaimDetails } from "@/actions/claim.actions";
import type { ActionResult } from "@/actions/quote.actions";
import { centsToDollars } from "@/domains/shared/money";

const initial: ActionResult | null = null;

const inputClass = "rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm";
const sectionClass = "flex flex-col gap-3 rounded-lg border border-border bg-background p-3";
const sectionTitleClass = "text-xs font-semibold uppercase tracking-wide text-muted";

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
 *
 * `m-auto` en el <dialog> es necesario a propósito: el Preflight de
 * Tailwind resetea `margin` a 0 en todos los elementos, lo que anula el
 * `margin: auto` que el navegador usa para centrar un <dialog> abierto con
 * `showModal()` — sin esto, el pop-up queda pegado a la esquina superior
 * izquierda (bug real reportado por el usuario).
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
        className="m-auto w-full max-w-2xl rounded-xl border border-border-strong bg-surface p-0 shadow-2xl backdrop:bg-black/70"
      >
        <form action={formAction} className="flex max-h-[85vh] flex-col">
          <input type="hidden" name="claimId" value={claim.id} />

          <div className="flex items-center justify-between rounded-t-xl bg-delta-navy px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">Editar siniestro</h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="text-sm text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
            <div className={sectionClass}>
              <p className={sectionTitleClass}>Datos del siniestro</p>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-sm">
                  N° de siniestro
                  <input name="claimNumber" defaultValue={claim.claimNumber ?? ""} className={inputClass} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Valor del siniestro (USD)
                  <input
                    name="claimValueDollars"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={claim.claimValueCents != null ? centsToDollars(claim.claimValueCents) : ""}
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-sm">
                  Fecha del siniestro
                  <input type="date" name="occurredAt" defaultValue={claim.occurredAt ?? ""} className={inputClass} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Fecha de reporte
                  <input type="date" name="reportedAt" defaultValue={claim.reportedAt ?? ""} className={inputClass} />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                Descripción
                <textarea name="description" rows={3} defaultValue={claim.description ?? ""} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Deducible aplicado (USD)
                <input
                  name="deductibleAppliedDollars"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={claim.deductibleAppliedCents != null ? centsToDollars(claim.deductibleAppliedCents) : ""}
                  className={inputClass}
                />
              </label>
            </div>

            {isStandalone && (
              <div className={sectionClass}>
                <p className={sectionTitleClass}>Vehículo</p>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1 text-sm">
                    Placa
                    <input name="vehiclePlate" defaultValue={vehicle.plate ?? ""} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Marca
                    <input name="vehicleBrand" defaultValue={vehicle.brand ?? ""} className={inputClass} />
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <label className="flex flex-col gap-1 text-sm">
                    Modelo
                    <input name="vehicleModel" defaultValue={vehicle.model ?? ""} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Año
                    <input name="vehicleYear" type="number" defaultValue={vehicle.year ?? ""} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Color
                    <input name="vehicleColor" defaultValue={vehicle.color ?? ""} className={inputClass} />
                  </label>
                </div>
              </div>
            )}

            <div className={sectionClass}>
              <p className={sectionTitleClass}>Taller y contacto</p>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-sm">
                  Taller
                  <input name="workshop" defaultValue={claim.workshop ?? ""} className={inputClass} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Asesor
                  <input name="advisorName" defaultValue={claim.advisorName ?? ""} className={inputClass} />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                Contacto
                <input name="contactPhone" defaultValue={claim.contactPhone ?? ""} className={inputClass} />
              </label>
            </div>

            <div className={sectionClass}>
              <p className={sectionTitleClass}>Responsabilidad civil (RC)</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="hasThirdPartyLiability" defaultChecked={claim.hasThirdPartyLiability} />
                Involucra RC (responsabilidad civil a terceros)
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-sm">
                  Placa del tercero
                  <input name="thirdPartyPlate" defaultValue={claim.thirdPartyPlate ?? ""} className={inputClass} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Valor del tercero (USD)
                  <input
                    name="thirdPartyValueDollars"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={claim.thirdPartyValueCents != null ? centsToDollars(claim.thirdPartyValueCents) : ""}
                    className={inputClass}
                  />
                </label>
              </div>
            </div>

            {state?.ok === false && "form" in state.errors && (
              <p className="text-sm text-bad">{state.errors.form[0]}</p>
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
