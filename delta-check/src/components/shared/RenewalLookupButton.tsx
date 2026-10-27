"use client";

import { useState, useTransition, type RefObject } from "react";
import { findRenewalData } from "@/actions/renewal.actions";
import { centsToDollars } from "@/domains/shared/money";

type Refs = {
  documentNumberRef: RefObject<HTMLInputElement | null>;
  plateRef: RefObject<HTMLInputElement | null>;
  brandRef: RefObject<HTMLInputElement | null>;
  modelRef: RefObject<HTMLInputElement | null>;
  yearRef: RefObject<HTMLInputElement | null>;
  bodyTypeRef: RefObject<HTMLSelectElement | null>;
  colorRef: RefObject<HTMLInputElement | null>;
  commercialValueRef: RefObject<HTMLInputElement | null>;
  extrasValueRef: RefObject<HTMLInputElement | null>;
  hasTrackerRef: RefObject<HTMLInputElement | null>;
  cityRef: RefObject<HTMLInputElement | null>;
  provinceRef: RefObject<HTMLSelectElement | null>;
  operationTypeRef: RefObject<HTMLSelectElement | null>;
  previousInsurerIdRef: RefObject<HTMLSelectElement | null>;
  previousPolicyNumberRef: RefObject<HTMLInputElement | null>;
  previousStartDateRef: RefObject<HTMLInputElement | null>;
  previousExpiryDateRef: RefObject<HTMLInputElement | null>;
  previousPremiumRef: RefObject<HTMLInputElement | null>;
  executiveRef: RefObject<HTMLInputElement | null>;
  /** El formulario muestra el bloque de renovación según el tipo de operación (estado de React, no solo el valor del select). */
  onRenewalFound: () => void;
};

/**
 * "Buscar cotización anterior" — retoma BUSCAR_BASE_VEHICULOS del Excel
 * (EXCEL-AUDIT.md §5): busca por cédula/RUC el último vehículo del cliente
 * en nuestra propia base y precarga el formulario, incluida la aseguradora
 * y póliza anterior si hubo una emitida, y el campo EJECUTIVO con el que
 * ya tenía guardado ese cliente (no con el usuario logueado ahora — puede
 * ser otra persona la que originalmente lo trajo). Nunca bloquea el
 * formulario — si no encuentra nada, el ejecutivo sigue con una cotización
 * NUEVA normal.
 */
export function RenewalLookupButton(refs: Refs) {
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const documentNumber = refs.documentNumberRef.current?.value.trim() ?? "";
    if (!documentNumber) {
      setMessage({ kind: "error", text: "Escribe el documento primero" });
      return;
    }
    setMessage(null);

    startTransition(async () => {
      const result = await findRenewalData(documentNumber);

      if (result.status === "NOT_FOUND") {
        setMessage({ kind: "error", text: "Cliente nuevo — no hay datos anteriores" });
        return;
      }
      if (result.status === "NO_VEHICLE") {
        if (refs.executiveRef.current && result.clientExecutive) refs.executiveRef.current.value = result.clientExecutive;
        setMessage({ kind: "error", text: "Cliente encontrado, pero sin vehículos anteriores" });
        return;
      }

      if (refs.executiveRef.current && result.clientExecutive) refs.executiveRef.current.value = result.clientExecutive;

      const { vehicle } = result;
      if (refs.plateRef.current) refs.plateRef.current.value = vehicle.plate;
      if (refs.brandRef.current) refs.brandRef.current.value = vehicle.brand;
      if (refs.modelRef.current) refs.modelRef.current.value = vehicle.model;
      if (refs.yearRef.current) refs.yearRef.current.value = String(vehicle.year);
      if (refs.bodyTypeRef.current) refs.bodyTypeRef.current.value = vehicle.bodyType;
      if (refs.colorRef.current) refs.colorRef.current.value = vehicle.color ?? "";
      if (refs.commercialValueRef.current) {
        refs.commercialValueRef.current.value = String(centsToDollars(vehicle.commercialValueCents));
      }
      if (refs.extrasValueRef.current) {
        refs.extrasValueRef.current.value = String(centsToDollars(vehicle.extrasValueCents));
      }
      if (refs.hasTrackerRef.current) refs.hasTrackerRef.current.checked = vehicle.hasTracker;
      if (refs.cityRef.current) refs.cityRef.current.value = vehicle.city ?? "";
      if (refs.provinceRef.current) refs.provinceRef.current.value = vehicle.province ?? "";
      if (refs.operationTypeRef.current) refs.operationTypeRef.current.value = "RENOVACION";
      if (refs.previousInsurerIdRef.current) refs.previousInsurerIdRef.current.value = result.previousInsurerId ?? "";
      if (refs.previousPolicyNumberRef.current) {
        refs.previousPolicyNumberRef.current.value = result.previousPolicyNumber ?? "";
      }
      if (refs.previousStartDateRef.current) refs.previousStartDateRef.current.value = result.previousStartDate ?? "";
      if (refs.previousExpiryDateRef.current) {
        refs.previousExpiryDateRef.current.value = result.previousExpiryDate ?? "";
      }
      if (refs.previousPremiumRef.current) {
        refs.previousPremiumRef.current.value =
          result.previousPremiumCents != null ? String(centsToDollars(result.previousPremiumCents)) : "";
      }
      refs.onRenewalFound();

      setMessage({ kind: "ok", text: `Precargado: ${vehicle.plate}` });
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-surface disabled:opacity-60"
      >
        {pending ? "Buscando…" : "Buscar cotización anterior"}
      </button>
      {message && (
        <p className={`text-xs ${message.kind === "ok" ? "text-green-700" : "text-amber-700"}`}>{message.text}</p>
      )}
    </div>
  );
}
