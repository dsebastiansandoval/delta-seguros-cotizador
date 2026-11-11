"use client";

import { useActionState, useState } from "react";
import { updateDeductibleProfile, type DeductibleProfileRow } from "@/actions/deductible.actions";
import type { ActionResult } from "@/actions/quote.actions";

const inputClass = "w-full rounded-md border border-border bg-surface px-2 py-1 text-sm";

function OptionList({
  label,
  options,
  setOptions,
  defaultIndex,
  setDefaultIndex,
  name,
}: {
  label: string;
  options: string[];
  setOptions: (next: string[]) => void;
  defaultIndex: number;
  setDefaultIndex: (i: number) => void;
  name: string;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="flex flex-col gap-1">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name={`${name}-default`}
              checked={defaultIndex === i}
              onChange={() => setDefaultIndex(i)}
              title="Usar como valor por defecto"
            />
            <input
              name={name}
              value={opt}
              onChange={(e) => {
                const next = [...options];
                next[i] = e.target.value;
                setOptions(next);
              }}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => {
                const next = options.filter((_, idx) => idx !== i);
                setOptions(next);
                if (defaultIndex >= next.length) setDefaultIndex(Math.max(0, next.length - 1));
                else if (defaultIndex > i) setDefaultIndex(defaultIndex - 1);
              }}
              className="text-xs text-red-600"
              disabled={options.length <= 1}
            >
              Quitar
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setOptions([...options, ""])} className="mt-1 text-xs font-semibold text-link underline">
        + Agregar opción
      </button>
    </div>
  );
}

function PartsList({ label, parts, setParts, name }: { label: string; parts: string[]; setParts: (next: string[]) => void; name: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="flex flex-col gap-1">
        {parts.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              name={name}
              value={p}
              onChange={(e) => {
                const next = [...parts];
                next[i] = e.target.value;
                setParts(next);
              }}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setParts(parts.filter((_, idx) => idx !== i))}
              className="text-xs text-red-600"
              disabled={parts.length <= 1}
            >
              Quitar
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setParts([...parts, ""])} className="mt-1 text-xs font-semibold text-link underline">
        + Agregar fragmento
      </button>
    </div>
  );
}

const initial: ActionResult | null = null;

export function DeductibleProfileForm({ profile }: { profile: DeductibleProfileRow }) {
  const [state, formAction, pending] = useActionState(updateDeductibleProfile, initial);
  const usesParts = profile.partialParts != null;

  const [partialOptions, setPartialOptions] = useState(profile.partialOptions.length ? profile.partialOptions : [profile.partialDefault]);
  const [partialDefaultIndex, setPartialDefaultIndex] = useState(Math.max(0, partialOptions.indexOf(profile.partialDefault)));
  const [totalLossOptions, setTotalLossOptions] = useState(profile.totalLossOptions.length ? profile.totalLossOptions : [profile.totalLossDefault]);
  const [totalLossDefaultIndex, setTotalLossDefaultIndex] = useState(Math.max(0, totalLossOptions.indexOf(profile.totalLossDefault)));
  const [vs, setVs] = useState(profile.partialParts?.vs ?? [""]);
  const [va, setVa] = useState(profile.partialParts?.va ?? [""]);
  const [min, setMin] = useState(profile.partialParts?.min ?? [""]);
  const [partsDefault, setPartsDefault] = useState(profile.partialDefault);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <input type="hidden" name="insurerId" value={profile.insurerId} />
      <input type="hidden" name="usesParts" value={usesParts ? "1" : "0"} />
      <input type="hidden" name="partialDefault" value={usesParts ? partsDefault : (partialOptions[partialDefaultIndex] ?? "")} />
      <input type="hidden" name="totalLossDefault" value={totalLossOptions[totalLossDefaultIndex] ?? ""} />

      <header className="flex items-center justify-between">
        <h3 className="font-semibold">{profile.name}</h3>
        {profile.isOverridden ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Editado</span>
        ) : (
          <span className="text-xs text-muted">Valor original del Excel</span>
        )}
      </header>

      {usesParts ? (
        <div className="grid grid-cols-3 gap-4">
          <PartsList label="% sobre VS" parts={vs} setParts={setVs} name="partsVs" />
          <PartsList label="% VA / mínimo" parts={va} setParts={setVa} name="partsVa" />
          <PartsList label="Mínimo" parts={min} setParts={setMin} name="partsMin" />
          <div className="col-span-3">
            <label className="flex flex-col gap-1 text-sm">
              Deducible parcial por defecto (texto completo armado)
              <input value={partsDefault} onChange={(e) => setPartsDefault(e.target.value)} className={inputClass} />
            </label>
          </div>
        </div>
      ) : (
        <OptionList label="Deducible parcial — opciones" options={partialOptions} setOptions={setPartialOptions} defaultIndex={partialDefaultIndex} setDefaultIndex={setPartialDefaultIndex} name="partialOptions" />
      )}

      <OptionList
        label="Pérdida total — opciones"
        options={totalLossOptions}
        setOptions={setTotalLossOptions}
        defaultIndex={totalLossDefaultIndex}
        setDefaultIndex={setTotalLossDefaultIndex}
        name="totalLossOptions"
      />

      {state?.ok === false && "form" in state.errors && <p className="text-sm text-red-600">{state.errors.form[0]}</p>}

      <button type="submit" disabled={pending} className="self-start rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
