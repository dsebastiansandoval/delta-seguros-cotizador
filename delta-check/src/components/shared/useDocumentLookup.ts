"use client";

import { useRef, useState, useTransition, type FocusEvent, type RefObject } from "react";
import { lookupBirthDateByDocument, lookupPersonByDocument } from "@/actions/lookup.actions";
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
 *
 * Si viene `onBirthDate`, además dispara en paralelo (nunca bloquea al SRI,
 * ni al revés) una consulta paga a EcuadorAPI por la fecha de nacimiento y
 * la pasa a ese callback cuando se encuentra — nunca se llama si no hay
 * dato. Cada formulario decide cómo usarla y respeta lo que el usuario ya
 * haya escrito a mano. Solo aplica a cédula o RUC de persona natural
 * (Jurídica no tiene fecha de nacimiento). Un callback en vez de exponer el
 * resultado como estado propio: así cada formulario lo aplica directo
 * dentro del mismo evento (onBlur), sin necesitar un efecto aparte que
 * reaccione al cambio.
 */
export function useDocumentLookup({
  documentTypeRef,
  firstNameRef,
  lastNameRef,
  provinceRef,
  businessNameRef,
  onBirthDate,
}: {
  documentTypeRef: RefObject<HTMLSelectElement | null>;
  firstNameRef: RefObject<HTMLInputElement | null>;
  lastNameRef: RefObject<HTMLInputElement | null>;
  provinceRef?: RefObject<HTMLInputElement | null>;
  /** Jurídica (DATOS VH!C10 "NOMBRE:") — distinto de Nombres/Apellidos, que no aplican. */
  businessNameRef?: RefObject<HTMLInputElement | null>;
  onBirthDate?: (birthDate: string) => void;
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

    // Los 2 primeros dígitos de la cédula determinan la provincia (local,
    // instantánea, sin esperar al SRI) y son el mismo dato que necesita la
    // fecha de nacimiento — para RUC de sociedad ninguno de los dos aplica
    // (no hay cédula detrás).
    const cedulaDigits = documentType === "CEDULA" ? value : isNaturalPersonRuc(value) ? value.slice(0, 10) : null;
    if (provinceRef?.current) {
      provinceRef.current.value = cedulaDigits ? (provinceFromCedula(cedulaDigits) ?? "") : "";
    }

    startTransition(async () => {
      const birthDatePromise =
        onBirthDate && cedulaDigits ? lookupBirthDateByDocument(cedulaDigits).catch(() => null) : null;

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

      if (birthDatePromise) {
        const birthResult = await birthDatePromise;
        if (birthResult?.status === "FOUND") onBirthDate?.(birthResult.birthDate);
      }
    });
  }

  return { onBlur, message, pending };
}
