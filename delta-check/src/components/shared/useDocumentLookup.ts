"use client";

import { useState, useTransition, type FocusEvent, type RefObject } from "react";
import { lookupPersonByDocument } from "@/actions/lookup.actions";
import { isValidCedula, isValidRuc } from "@/domains/lookup/cedula.validator";

/**
 * Autocompletado automático de Nombres/Apellidos/Provincia al salir del
 * campo "Documento" — reemplaza el botón manual "Buscar en SRI" que existía
 * antes (`CedulaLookupButton`, borrado). Dispara solo si el valor pasa la
 * validación local de formato (cédula o RUC según el select "Tipo de
 * documento") — nunca en cada tecla, nunca con un Pasaporte (sin fuente).
 */
export function useDocumentLookup({
  documentTypeRef,
  firstNameRef,
  lastNameRef,
  provinceRef,
}: {
  documentTypeRef: RefObject<HTMLSelectElement | null>;
  firstNameRef: RefObject<HTMLInputElement | null>;
  lastNameRef: RefObject<HTMLInputElement | null>;
  provinceRef?: RefObject<HTMLInputElement | null>;
}) {
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onBlur(event: FocusEvent<HTMLInputElement>) {
    const value = event.target.value.trim();
    const documentType = documentTypeRef.current?.value;
    setMessage(null);
    if (!value || (documentType !== "CEDULA" && documentType !== "RUC")) return;
    if (documentType === "CEDULA" && !isValidCedula(value)) return;
    if (documentType === "RUC" && !isValidRuc(value)) return;

    startTransition(async () => {
      const result = await lookupPersonByDocument(value, documentType);

      if (result.status === "FOUND" && result.kind === "NATURAL") {
        if (firstNameRef.current) firstNameRef.current.value = result.firstName;
        if (lastNameRef.current) lastNameRef.current.value = result.lastName;
        if (provinceRef?.current) provinceRef.current.value = result.province ?? "";
        setMessage({
          kind: "ok",
          text: result.province ? `Encontrado: ${result.fullName} — cédula de ${result.province}` : `Encontrado: ${result.fullName}`,
        });
      } else if (result.status === "FOUND" && result.kind === "JURIDICA") {
        if (firstNameRef.current) firstNameRef.current.value = result.businessName;
        if (lastNameRef.current) lastNameRef.current.value = "";
        setMessage({ kind: "ok", text: `Encontrado: ${result.businessName}` });
      } else if (result.status === "NOT_FOUND") {
        setMessage({ kind: "error", text: "No se encontró en el SRI — digita el nombre a mano" });
      } else {
        setMessage({ kind: "error", text: result.message });
      }
    });
  }

  return { onBlur, message, pending };
}
