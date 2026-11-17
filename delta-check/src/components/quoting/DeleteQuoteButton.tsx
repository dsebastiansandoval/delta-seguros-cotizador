"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteQuote } from "@/actions/quote.actions";

/** "Eliminar" en Mis cotizaciones — solo visible para quien tiene quote:delete (ver la página que lo usa). */
export function DeleteQuoteButton({ quoteId, quoteCode }: { quoteId: string; quoteCode: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm(`¿Eliminar la cotización ${quoteCode}? No se puede deshacer.`)) return;
    startTransition(async () => {
      const result = await deleteQuote(quoteId);
      if (result.ok) {
        router.refresh();
      } else {
        setError(Object.values(result.errors).flat()[0] ?? "No se pudo eliminar");
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="text-xs font-semibold text-bad underline disabled:opacity-60"
      >
        {pending ? "…" : "Eliminar"}
      </button>
      {error && <span className="text-xs text-bad">{error}</span>}
    </span>
  );
}
