"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const OPTIONS: Array<{ href: string; label: string; branch?: "AUTOS" | "SALUD"; disabled?: boolean }> = [
  { href: "/cotizar/autos/nueva", label: "Autos", branch: "AUTOS" },
  { href: "/cotizar/salud/nueva", label: "Salud AM", branch: "SALUD" },
  { href: "#", label: "Vida & Patrimonio", disabled: true },
];

/**
 * CTA "+ Nueva Cotización" arriba del sidebar — selector rápido de ramo,
 * no reemplaza los links directos de "Cotizador" (siguen ahí para quien ya
 * sabe adónde va). Mismo patrón de dropdown que AccountMenu.tsx
 * (useState + click-outside), no una librería de modal nueva.
 */
/** `branches`: ramos habilitados del usuario — solo esos aparecen como opción. */
export function NuevaCotizacionMenu({ branches }: { branches: Array<"AUTOS" | "SALUD"> }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative mb-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-delta-navy px-3 py-2.5 text-sm font-semibold text-white hover:bg-delta-navy-2"
      >
        + Nueva cotización
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-full rounded-xl border border-border bg-surface p-1.5 text-sm shadow-lg">
          {OPTIONS.filter((o) => !o.branch || branches.includes(o.branch)).map((option) =>
            option.disabled ? (
              <span
                key={option.label}
                title="Próximamente"
                className="flex items-center justify-between rounded-md px-2.5 py-2 text-muted opacity-60"
              >
                {option.label}
                <span className="rounded bg-background px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide">
                  Pronto
                </span>
              </span>
            ) : (
              <Link
                key={option.href}
                href={option.href}
                onClick={() => setOpen(false)}
                className="block rounded-md px-2.5 py-2 font-medium text-foreground no-underline hover:bg-background"
              >
                {option.label}
              </Link>
            ),
          )}
        </div>
      )}
    </div>
  );
}
