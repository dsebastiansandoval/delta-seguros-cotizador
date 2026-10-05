"use client";

import { useState, useTransition, type FocusEvent, type RefObject } from "react";
import { lookupVehicleByPlate } from "@/actions/lookup.actions";

const PLATE_FORMAT = /^[A-Za-z]{2,3}[\s-]?\d{3,4}$/;

/**
 * Autocompletado automático de Marca/Modelo/Año/Color/Tipo al salir del
 * campo "Placa" (EcuadorAPI). Dispara solo si el valor tiene pinta de placa
 * ecuatoriana — nunca en cada tecla.
 */
export function usePlateLookup({
  brandRef,
  modelRef,
  yearRef,
  colorRef,
  bodyTypeRef,
}: {
  brandRef: RefObject<HTMLInputElement | null>;
  modelRef: RefObject<HTMLInputElement | null>;
  yearRef: RefObject<HTMLInputElement | null>;
  colorRef?: RefObject<HTMLInputElement | null>;
  bodyTypeRef?: RefObject<HTMLSelectElement | null>;
}) {
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onBlur(event: FocusEvent<HTMLInputElement>) {
    const value = event.target.value.trim();
    setMessage(null);
    if (!value || !PLATE_FORMAT.test(value)) return;

    startTransition(async () => {
      const result = await lookupVehicleByPlate(value);

      if (result.status === "FOUND") {
        if (brandRef.current) brandRef.current.value = result.brand;
        if (modelRef.current) modelRef.current.value = result.model;
        if (yearRef.current) yearRef.current.value = String(result.year);
        if (colorRef?.current && result.color) colorRef.current.value = result.color;
        if (bodyTypeRef?.current) bodyTypeRef.current.value = result.bodyType;
        setMessage({ kind: "ok", text: `Encontrado: ${result.brand} ${result.model} ${result.year}` });
      } else if (result.status === "NOT_FOUND") {
        setMessage({ kind: "error", text: "No se encontró esa placa — completa los datos a mano" });
      } else {
        setMessage({ kind: "error", text: result.message });
      }
    });
  }

  return { onBlur, message, pending };
}
