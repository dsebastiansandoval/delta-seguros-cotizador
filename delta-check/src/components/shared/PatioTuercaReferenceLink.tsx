"use client";

import { useState, type RefObject } from "react";
import { buildPatioTuercaUrl } from "@/domains/shared/patiotuerca-link";

/**
 * Abre la guía de precios de PatioTuerca para la marca/modelo/año que el
 * agente ya escribió — solo arma la URL y la abre en pestaña nueva, no
 * trae el dato al sistema. Ver ARCHITECTURE.md §16.
 */
export function PatioTuercaReferenceLink({
  brandRef,
  modelRef,
  yearRef,
  modelsByBrand,
}: {
  brandRef: RefObject<HTMLInputElement | null>;
  modelRef: RefObject<HTMLInputElement | null>;
  yearRef: RefObject<HTMLInputElement | null>;
  /** Catálogo real (el mismo que llena el datalist de "Modelo") — para reconocer el código base del modelo dentro de un texto más largo. */
  modelsByBrand?: Record<string, string[]>;
}) {
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    const brand = brandRef.current?.value ?? "";
    const url = buildPatioTuercaUrl(
      brand,
      modelRef.current?.value ?? "",
      yearRef.current?.value ?? "",
      modelsByBrand?.[brand] ?? [],
    );
    if (!url) {
      setMessage("Completa marca, modelo y año primero");
      return;
    }
    setMessage(null);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-surface"
      >
        Ver referencia de precio en PatioTuerca ↗
      </button>
      {message && <p className="text-xs text-amber-700">{message}</p>}
    </div>
  );
}
