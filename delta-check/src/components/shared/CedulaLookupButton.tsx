"use client";

import { useState, useTransition, type RefObject } from "react";
import { lookupPersonByCedula } from "@/actions/lookup.actions";

/**
 * "Buscar" junto al campo Documento — autocompleta Nombres/Apellidos
 * consultando el RUC de persona natural en el SRI (cédula + "001"), la
 * misma fuente real que usa el Registro Civil para el nombre legal. Nunca
 * bloquea el formulario: si no encuentra nada o el servicio falla, los
 * campos quedan para digitación manual, igual que el resto de datos sin
 * fuente automática en este proyecto.
 */
export function CedulaLookupButton({
  documentNumberRef,
  firstNameRef,
  lastNameRef,
  provinceRef,
}: {
  documentNumberRef: RefObject<HTMLInputElement | null>;
  firstNameRef: RefObject<HTMLInputElement | null>;
  lastNameRef: RefObject<HTMLInputElement | null>;
  /** Opcional — casilla informativa "Provincia (según cédula)", nunca se envía en el formulario. */
  provinceRef?: RefObject<HTMLInputElement | null>;
}) {
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const documentNumber = documentNumberRef.current?.value.trim() ?? "";
    setMessage(null);

    startTransition(async () => {
      const result = await lookupPersonByCedula(documentNumber);

      if (result.status === "FOUND") {
        if (firstNameRef.current) firstNameRef.current.value = result.firstName;
        if (lastNameRef.current) lastNameRef.current.value = result.lastName;
        if (provinceRef?.current) provinceRef.current.value = result.province ?? "";
        setMessage({
          kind: "ok",
          text: result.province
            ? `Encontrado: ${result.fullName} — cédula de ${result.province}`
            : `Encontrado: ${result.fullName}`,
        });
      } else if (result.status === "NOT_FOUND") {
        setMessage({ kind: "error", text: "No se encontró en el SRI — digita el nombre a mano" });
      } else {
        setMessage({ kind: "error", text: result.message });
      }
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
        {pending ? "Buscando…" : "Buscar en SRI"}
      </button>
      {message && (
        <p className={`text-xs ${message.kind === "ok" ? "text-green-700" : "text-amber-700"}`}>{message.text}</p>
      )}
    </div>
  );
}
