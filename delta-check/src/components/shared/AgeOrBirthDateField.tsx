"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fecha de nacimiento con un checkbox "Edad" al lado — a veces el agente
 * no tiene la fecha exacta a mano, solo la edad que le dio el cliente.
 * Marcando el checkbox cambia el campo de fecha por uno de edad en años;
 * solo uno de los dos se envía (tienen nombres distintos), nunca ambos.
 * El backend resuelve la edad final desde cualquiera de los dos
 * (shared/age.ts, `resolveAge`) — la edad directa manda si está.
 */
export function AgeOrBirthDateField({
  namePrefix,
  required,
  autoBirthDate,
}: {
  namePrefix: string;
  required?: boolean;
  /** Sugerencia de EcuadorAPI al buscar por cédula — nunca pisa lo que el usuario ya haya tocado a mano. */
  autoBirthDate?: string | null;
}) {
  const [useAge, setUseAge] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);
  const touched = useRef(false);

  useEffect(() => {
    if (!autoBirthDate || touched.current) return;
    setUseAge(false);
    if (dateRef.current) dateRef.current.value = autoBirthDate;
  }, [autoBirthDate]);

  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex items-center justify-between">
        <span>{useAge ? "Edad" : "Fecha de nacimiento"}</span>
        <label className="flex items-center gap-1.5 text-xs font-normal text-muted">
          <input
            type="checkbox"
            checked={useAge}
            onChange={(e) => {
              touched.current = true;
              setUseAge(e.target.checked);
            }}
          />
          Edad
        </label>
      </div>
      {useAge ? (
        <input
          name={`${namePrefix}AgeInput`}
          type="number"
          min={0}
          max={120}
          required={required}
          placeholder="Edad en años"
          onChange={() => {
            touched.current = true;
          }}
          className="rounded-lg border border-border bg-surface px-3 py-2"
        />
      ) : (
        <input
          ref={dateRef}
          name={`${namePrefix}BirthDate`}
          type="date"
          required={required}
          onChange={() => {
            touched.current = true;
          }}
          className="rounded-lg border border-border bg-surface px-3 py-2"
        />
      )}
    </div>
  );
}
