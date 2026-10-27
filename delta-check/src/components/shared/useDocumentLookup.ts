"use client";

import { useRef, useState, useTransition, type FocusEvent, type RefObject } from "react";
import { lookupPersonByDocument } from "@/actions/lookup.actions";
import { isNaturalPersonRuc, isValidCedula, isValidRuc, provinceFromCedula } from "@/domains/lookup/cedula.validator";

/**
 * Autocompletado automático de Nombres/Apellidos/Provincia al salir del
 * campo "Documento" — reemplaza el botón manual "Buscar en SRI" que existía
 * antes (`CedulaLookupButton`, borrado). Dispara solo si el valor pasa la
 * validación local de formato (cédula o RUC según el select "Tipo de
 * documento") — nunca en cada tecla, nunca con un Pasaporte (sin fuente).
 *
 * La provincia se calcula local e instantáneamente (los 2 primeros dígitos
 * de la cédula son el código INEC de provincia, `provinceFromCedula`) —
 * no espera la respuesta del SRI, que solo hace falta para Nombres/
 * Apellidos. Así no depende de que el SRI esté arriba ni de la latencia de
 * esa consulta.
 */
export function useDocumentLookup({
  documentTypeRef,
  firstNameRef,
  lastNameRef,
  provinceRef,
  businessNameRef,
}: {
  documentTypeRef: RefObject<HTMLSelectElement | null>;
  firstNameRef: RefObject<HTMLInputElement | null>;
  lastNameRef: RefObject<HTMLInputElement | null>;
  provinceRef?: RefObject<HTMLInputElement | null>;
  /** Jurídica (DATOS VH!C10 "NOMBRE:") — distinto de Nombres/Apellidos, que no aplican. */
  businessNameRef?: RefObject<HTMLInputElement | null>;
}) {
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const lastLookedUp = useRef<string | null>(null);

  function onBlur(event: FocusEvent<HTMLInputElement>) {
    const value = event.target.value.trim();
    const documentType = documentTypeRef.current?.value;
    setMessage(null);
    if (!value || (documentType !== "CEDULA" && documentType !== "RUC")) return;
    if (documentType === "CEDULA" && !isValidCedula(value)) return;
    if (documentType === "RUC" && !isValidRuc(value)) return;
    const lookupKey = `${documentType}:${value}`;
    if (lookupKey === lastLookedUp.current) return;

    // Provincia: local, instantánea, sin esperar al SRI — los 2 primeros
    // dígitos ya la determinan. Para RUC de sociedad no aplica (no hay
    // cédula detrás), queda como estaba.
    if (provinceRef?.current) {
      const cedulaDigits = documentType === "CEDULA" ? value : isNaturalPersonRuc(value) ? value.slice(0, 10) : null;
      provinceRef.current.value = cedulaDigits ? (provinceFromCedula(cedulaDigits) ?? "") : "";
    }

    startTransition(async () => {
      try {
        const result = await lookupPersonByDocument(value, documentType);
        lastLookedUp.current = lookupKey;

        if (result.status === "FOUND" && result.kind === "NATURAL") {
          if (firstNameRef.current) firstNameRef.current.value = result.firstName;
          if (lastNameRef.current) lastNameRef.current.value = result.lastName;
          if (provinceRef?.current) provinceRef.current.value = result.province ?? "";
          setMessage({ kind: "ok", text: "Encontrado" });
        } else if (result.status === "FOUND" && result.kind === "JURIDICA") {
          if (businessNameRef?.current) businessNameRef.current.value = result.businessName;
          setMessage({ kind: "ok", text: "Encontrado" });
        } else if (result.status === "NOT_FOUND") {
          setMessage({ kind: "error", text: "No se encontró en el SRI — digita el nombre a mano" });
        } else {
          setMessage({ kind: "error", text: result.message });
        }
      } catch {
        setMessage({ kind: "error", text: "No se pudo consultar el documento — digita el nombre a mano" });
      }
    });
  }

  return { onBlur, message, pending };
}
