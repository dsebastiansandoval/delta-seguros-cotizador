"use client";

import { useEffect, useState, type RefObject } from "react";

export const VEHICLE_COLORS = [
  { value: "BLANCO", label: "Blanco", hex: "#F3F4F6" },
  { value: "NEGRO", label: "Negro", hex: "#111827" },
  { value: "GRIS", label: "Gris/Plata", hex: "#9CA3AF" },
  { value: "ROJO", label: "Rojo", hex: "#DC2626" },
  { value: "AZUL", label: "Azul", hex: "#2563EB" },
  { value: "VERDE", label: "Verde", hex: "#16A34A" },
  { value: "AMARILLO", label: "Amarillo", hex: "#FACC15" },
  { value: "BEIGE", label: "Café/Beige", hex: "#A8876B" },
  { value: "NARANJA", label: "Naranja", hex: "#EA580C" },
  { value: "VINO", label: "Vino", hex: "#7F1D1D" },
  { value: "DORADO", label: "Dorado", hex: "#CA8A04" },
  { value: "OTRO", label: "Otro", hex: null },
] as const;

/** "Blanco perla" → BLANCO, "Gris oscuro metálico" → GRIS... cae en OTRO si no reconoce ninguna palabra. */
function closestColor(raw: string): string {
  const upper = raw.toUpperCase();
  return VEHICLE_COLORS.find((c) => c.value !== "OTRO" && upper.includes(c.value))?.value ?? "OTRO";
}

/**
 * Recuadros de color en vez de un `<input>` de texto libre (pedido del
 * cliente). El valor real sigue viviendo en un `<input type="hidden">` con
 * el mismo `ref` que ya usan `usePlateLookup.ts` y `RenewalLookupButton.tsx`
 * para escribirlo directo al encontrar un color por placa o por una
 * cotización anterior — en vez de reescribir esos dos flujos a React state,
 * este componente solo escucha el evento `input` que disparan después de
 * mutar el ref, para resaltar el recuadro correcto sin duplicar el valor.
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

  useEffect(() => {
    const input = colorRef.current;
    if (!input) return;
    const onInput = () => setSelected(closestColor(input.value));
    input.addEventListener("input", onInput);
    return () => input.removeEventListener("input", onInput);
  }, [colorRef]);

  function pick(value: string) {
    setSelected(value);
    if (colorRef.current) colorRef.current.value = value;
  }

  const activeLabel = VEHICLE_COLORS.find((c) => c.value === selected)?.label ?? "";

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span>Color</span>
      <input ref={colorRef} type="hidden" name={name} defaultValue={initialValue ?? ""} />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Color del vehículo">
        {VEHICLE_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => pick(c.value)}
            title={c.label}
            aria-label={c.label}
            aria-pressed={selected === c.value}
            className={`h-7 w-7 rounded-md border-2 ${
              selected === c.value ? "border-delta-navy ring-2 ring-delta-navy/40" : "border-border"
            }`}
            style={{
              background: c.hex ?? "repeating-linear-gradient(45deg, #d1d5db, #d1d5db 3px, #ffffff 3px, #ffffff 6px)",
            }}
          />
        ))}
      </div>
      <span className="text-xs text-muted">{activeLabel}</span>
    </div>
  );
}
