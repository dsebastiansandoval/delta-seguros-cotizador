"use client";

import { useRef, useState, type RefObject } from "react";
import { inferGenderFromName } from "@/domains/clients/services/gender-from-name";

/**
 * Sugiere el género al perder foco el campo "Nombres" — nunca pisa un valor
 * que ya viene precargado (editar cotización) ni uno que el usuario eligió
 * a mano: tocar el <select> una sola vez apaga la sugerencia para siempre
 * en ese formulario. Mismo criterio que `useDocumentLookup`/`usePlateLookup`
 * (autocompletar sin bloquear ni mentir con un dato inventado).
 */
export function useGenderSuggestion(genderRef: RefObject<HTMLSelectElement | null>) {
  const touched = useRef(false);
  const [suggested, setSuggested] = useState(false);

  return {
    suggested,
    onGenderChange() {
      touched.current = true;
      setSuggested(false);
    },
    onFirstNameBlur(value: string) {
      if (touched.current || !genderRef.current || genderRef.current.value !== "") return;
      const guess = inferGenderFromName(value);
      if (guess) {
        genderRef.current.value = guess;
        setSuggested(true);
      }
    },
  };
}
