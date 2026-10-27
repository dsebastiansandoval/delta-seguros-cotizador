"use client";

import { useState, type RefObject } from "react";
import { buildPatioTuercaLink, type PatioTuercaLink } from "@/domains/shared/patiotuerca-link";

/** Aviso cuando la página abierta no es exactamente lo escrito, para que el agente sepa qué está mirando. */
function messageFor(link: PatioTuercaLink, year: string): string | null {
  if (link.kind === "BRAND") return "PatioTuerca no tiene este modelo — elige el modelo en la lista de la marca";
  if (link.kind !== "MODEL" || !link.name) return null;
  const opened = link.exact ? null : `Abrí «${link.name}», lo más cercano que tiene PatioTuerca.`;
  const near = link.nearestYears.slice(0, 3).sort((a, b) => a - b).join(", ");
  const noYear = link.yearListed ? null : `PatioTuerca no tiene publicaciones de «${link.name}» ${year}; si sale sin precio, prueba ${near}.`;
  return [opened, noYear].filter(Boolean).join(" ") || null;
}

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
    const link = buildPatioTuercaLink(
      brand,
      modelRef.current?.value ?? "",
      yearRef.current?.value ?? "",
      modelsByBrand?.[brand] ?? [],
    );
    if (!link) {
      setMessage("Completa marca, modelo y año primero");
      return;
    }
    if (link.kind === "UNAVAILABLE") {
      setMessage("PatioTuerca no tiene precios de esta marca");
      return;
    }
    setMessage(messageFor(link, yearRef.current?.value.trim() ?? ""));
    window.open(link.url, "_blank", "noopener,noreferrer");
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
