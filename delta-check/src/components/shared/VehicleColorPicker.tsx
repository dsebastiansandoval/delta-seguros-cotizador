"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** Lista oficial de colores de la ANT (matriculación vehicular Ecuador) — 18 colores + OTRO como comodín técnico. */
export const VEHICLE_COLORS = [
  { value: "AMARILLO", label: "Amarillo", hex: "#FFD400" },
  { value: "ANARANJADO", label: "Anaranjado", hex: "#FF7A00" },
  { value: "AZUL", label: "Azul", hex: "#2563EB" },
  { value: "BLANCO", label: "Blanco", hex: "#F3F4F6" },
  { value: "CAFE", label: "Café", hex: "#6F4E37" },
  {
    value: "CAMUFLADO",
    label: "Camuflado",
    hex: "linear-gradient(135deg, #4B5320 25%, #78866B 25%, #78866B 50%, #3B4226 50%, #3B4226 75%, #78866B 75%)",
  },
  { value: "CELESTE", label: "Celeste", hex: "#7DD3FC" },
  { value: "COBRE", label: "Cobre", hex: "#B87333" },
  { value: "CREMA", label: "Crema", hex: "#F5E6C8" },
  { value: "DORADO", label: "Dorado", hex: "#CA8A04" },
  { value: "MORADO", label: "Morado", hex: "#7C3AED" },
  { value: "NEGRO", label: "Negro", hex: "#111827" },
  { value: "PLATEADO", label: "Plateado", hex: "#C0C0C0" },
  { value: "PLOMO", label: "Plomo", hex: "#71797E" },
  { value: "ROJO", label: "Rojo", hex: "#DC2626" },
  { value: "ROSADO", label: "Rosado", hex: "#F472B6" },
  { value: "VERDE", label: "Verde", hex: "#16A34A" },
  { value: "VINO", label: "Vino", hex: "#7F1D1D" },
  { value: "OTRO", label: "Otro", hex: null },
] as const;

/**
 * Términos que la API de placas (u otra cotización anterior, de antes de
 * este cambio) puede traer y que no son uno de los 18 nombres oficiales de
 * la ANT — se revisan antes del match genérico de abajo.
 */
const COLOR_ALIASES: Record<string, string> = {
  GRIS: "PLOMO",
  NARANJA: "ANARANJADO",
  BEIGE: "CAFE",
  PLATA: "PLATEADO",
};

/** "Blanco perla" → BLANCO, "Gris oscuro metálico" → PLOMO... cae en OTRO si no reconoce ninguna palabra. */
function closestColor(raw: string): string {
  const upper = raw.toUpperCase();
  for (const [alias, value] of Object.entries(COLOR_ALIASES)) {
    if (upper.includes(alias)) return value;
  }
  return VEHICLE_COLORS.find((c) => c.value !== "OTRO" && upper.includes(c.value))?.value ?? "OTRO";
}

function Swatch({ hex }: { hex: string | null }) {
  return (
    <span
      aria-hidden
      className="block h-5 w-5 rounded border border-border"
      style={{
        background: hex ?? "repeating-linear-gradient(45deg, #d1d5db, #d1d5db 3px, #ffffff 3px, #ffffff 6px)",
      }}
    />
  );
}

/**
 * Botón con el color actual que abre un popup con la grilla de los 18
 * colores de la ANT (pedido del cliente — antes era una fila de recuadros
 * siempre visible, pero con 18 colores ya no entraba cómodo). El valor real
 * sigue viviendo en un `<input type="hidden">` con el mismo `ref` que ya
 * usan `usePlateLookup.ts` y `RenewalLookupButton.tsx` para escribirlo
 * directo al encontrar un color por placa o por una cotización anterior —
 * en vez de reescribir esos dos flujos a React state, este componente solo
 * escucha el evento `input` que disparan después de mutar el ref, para
 * resaltar el recuadro correcto sin duplicar el valor.
 */
export function VehicleColorPicker({
  name,
  initialValue,
  colorRef,
}: {
  name: string;
  initialValue?: string | null;
  colorRef: RefObject<HTMLInputElement | null>;
}) {
  const [selected, setSelected] = useState(() => closestColor(initialValue ?? ""));
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const input = colorRef.current;
    if (!input) return;
    const onInput = () => setSelected(closestColor(input.value));
    input.addEventListener("input", onInput);
    return () => input.removeEventListener("input", onInput);
  }, [colorRef]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pick(value: string) {
    setSelected(value);
    if (colorRef.current) colorRef.current.value = value;
    setOpen(false);
  }

  const active = VEHICLE_COLORS.find((c) => c.value === selected);

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1 text-sm">
      <span>Color</span>
      <input ref={colorRef} type="hidden" name={name} defaultValue={initialValue ?? ""} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
      >
        <Swatch hex={active?.hex ?? null} />
        <span>{active?.label ?? "Elegir"}</span>
      </button>
      {open && (
        <div
          role="group"
          aria-label="Color del vehículo"
          className="absolute top-full left-0 z-10 mt-1 grid w-64 grid-cols-6 gap-1.5 rounded-lg border border-border bg-surface p-2 shadow-lg"
        >
          {VEHICLE_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => pick(c.value)}
              title={c.label}
              aria-label={c.label}
              aria-pressed={selected === c.value}
              className={`flex h-8 w-8 items-center justify-center rounded-md border-2 ${
                selected === c.value ? "border-delta-navy ring-2 ring-delta-navy/40" : "border-border"
              }`}
              style={{
                background: c.hex ?? "repeating-linear-gradient(45deg, #d1d5db, #d1d5db 3px, #ffffff 3px, #ffffff 6px)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
