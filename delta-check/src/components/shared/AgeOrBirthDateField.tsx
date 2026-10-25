"use client";

import { useState } from "react";

/**
 * Fecha de nacimiento con un checkbox "Edad" al lado — a veces el agente
 * no tiene la fecha exacta a mano, solo la edad que le dio el cliente.
 * Marcando el checkbox cambia el campo de fecha por uno de edad en años;
 * solo uno de los dos se envía (tienen nombres distintos), nunca ambos.
 * El backend resuelve la edad final desde cualquiera de los dos
 * (health-quote.schema.ts, `resolveAge`) — la edad directa manda si está.
 */
export function AgeOrBirthDateField({ namePrefix, required }: { namePrefix: string; required?: boolean }) {
  const [useAge, setUseAge] = useState(false);

  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex items-center justify-between">
        <span>{useAge ? "Edad" : "Fecha de nacimiento"}</span>
        <label className="flex items-center gap-1.5 text-xs font-normal text-muted">
          <input type="checkbox" checked={useAge} onChange={(e) => setUseAge(e.target.checked)} />
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
          className="rounded-lg border border-border bg-surface px-3 py-2"
        />
      ) : (
        <input
          name={`${namePrefix}BirthDate`}
          type="date"
          required={required}
          className="rounded-lg border border-border bg-surface px-3 py-2"
        />
      )}
    </div>
  );
}
