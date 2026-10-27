"use client";

import { useActionState, useRef, useState } from "react";
import { createHealthQuote } from "@/actions/health-quote.actions";
import type { ActionResult } from "@/actions/quote.actions";
import { useDocumentLookup } from "@/components/shared/useDocumentLookup";
import { AgeOrBirthDateField } from "@/components/shared/AgeOrBirthDateField";
import { MAX_DEPENDENTS } from "@/domains/health/schemas/health-quote.schema";

const initialState: ActionResult<{ quoteId: string }> | null = null;

/**
 * `fieldNumber` es la posición actual (1-based, sin huecos) — determina el
 * `name` de los campos del formulario, que el schema solo reconoce de
 * dep1 a dep{MAX_DEPENDENTS} consecutivos. Es distinto de la `key` de
 * React que usa el padre (un id estable que nunca se reutiliza) — si no,
 * agregar y quitar varias veces podría correr el número de campo más allá
 * de MAX_DEPENDENTS aunque haya pocos dependientes visibles.
 */
function DependentFields({ fieldNumber, onRemove }: { fieldNumber: number; onRemove?: () => void }) {
  return (
    <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-border pt-4">
      {/* `<legend>` no respeta `display:flex` de forma consistente entre
          navegadores — el botón "Quitar" vive afuera, en un div normal, para
          que `justify-between` sí lo mande al final de la línea siempre. */}
      <div className="col-span-full flex items-center justify-between">
        <legend className="text-sm font-semibold">Dependiente {fieldNumber}</legend>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-xs font-semibold text-link underline">
            Quitar
          </button>
        )}
      </div>
      <AgeOrBirthDateField namePrefix={`dep${fieldNumber}`} />
      <label className="flex flex-col gap-1 text-sm">
        Sexo
        <select name={`dep${fieldNumber}Gender`} defaultValue="" className="rounded-lg border border-border bg-surface px-3 py-2">
          <option value="">—</option>
          <option value="MASCULINO">Masculino</option>
          <option value="FEMENINO">Femenino</option>
        </select>
      </label>
    </fieldset>
  );
}

export function NuevaCotizacionSaludForm({
  sources,
  executives,
  currentExecutive,
}: {
  sources: string[];
  executives: string[];
  /** Nombre del usuario logueado — precarga el campo Ejecutivo (editable). */
  currentExecutive: string;
}) {
  const [state, formAction, pending] = useActionState(createHealthQuote, initialState);
  const documentTypeRef = useRef<HTMLSelectElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const provinceRef = useRef<HTMLInputElement>(null);
  const documentLookup = useDocumentLookup({ documentTypeRef, firstNameRef, lastNameRef, provinceRef });

  // IDs estables para React (nunca se reutilizan, aunque se agregue y
  // quite varias veces) — distintos del número de campo (ver
  // DependentFields), que sí se recalcula por posición en cada render.
  const [dependentIds, setDependentIds] = useState<number[]>([1]);
  const nextDependentId = useRef(2);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          Ejecutivo
          <input
            name="executive"
            list="executives-datalist"
            defaultValue={currentExecutive}
            placeholder="Escribe o elige de la lista"
            autoComplete="off"
            className="rounded-lg border border-border bg-surface px-3 py-2"
          />
          <datalist id="executives-datalist">
            {executives.map((ex) => (
              <option key={ex} value={ex} />
            ))}
          </datalist>
        </label>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <legend className="col-span-full text-sm font-semibold">Cliente</legend>
        <label className="flex flex-col gap-1 text-sm">
          Tipo de persona
          <select name="personType" defaultValue="NATURAL" className="rounded-lg border border-border bg-surface px-3 py-2">
            <option value="NATURAL">Natural</option>
            <option value="JURIDICA">Jurídica</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tipo de documento
          <select
            ref={documentTypeRef}
            name="documentType"
            defaultValue="CEDULA"
            className="rounded-lg border border-border bg-surface px-3 py-2"
          >
            <option value="CEDULA">Cédula</option>
            <option value="RUC">RUC</option>
            <option value="PASAPORTE">Pasaporte</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Documento
          <input
            name="documentNumber"
            required
            onBlur={documentLookup.onBlur}
            className="rounded-lg border border-border bg-surface px-3 py-2"
          />
          {documentLookup.pending && <p className="text-xs text-muted">Buscando…</p>}
          {documentLookup.message && (
            <p className={`text-xs ${documentLookup.message.kind === "ok" ? "text-green-700" : "text-amber-700"}`}>
              {documentLookup.message.text}
            </p>
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Provincia
          <input
            ref={provinceRef}
            readOnly
            placeholder="—"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-muted"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Nombres
          <input ref={firstNameRef} name="firstName" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Apellidos
          <input ref={lastNameRef} name="lastName" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Fuente
          <input
            name="source"
            list="sources-datalist"
            placeholder="Escribe o elige de la lista"
            autoComplete="off"
            className="rounded-lg border border-border bg-surface px-3 py-2"
          />
          <datalist id="sources-datalist">
            {sources.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Región
          <select name="region" defaultValue="SIERRA" className="rounded-lg border border-border bg-surface px-3 py-2">
            <option value="SIERRA">Sierra</option>
            <option value="COSTA">Costa</option>
            <option value="AUSTRO">Austro</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="col-span-full text-sm font-semibold">Titular</legend>
        <AgeOrBirthDateField namePrefix="titular" required />
        <label className="flex flex-col gap-1 text-sm">
          Sexo
          <select name="titularGender" defaultValue="MASCULINO" className="rounded-lg border border-border bg-surface px-3 py-2">
            <option value="MASCULINO">Masculino</option>
            <option value="FEMENINO">Femenino</option>
          </select>
        </label>
      </fieldset>

      {dependentIds.map((id, index) => (
        <DependentFields
          key={id}
          fieldNumber={index + 1}
          onRemove={() => setDependentIds((ids) => ids.filter((existing) => existing !== id))}
        />
      ))}

      {dependentIds.length < MAX_DEPENDENTS && (
        <button
          type="button"
          onClick={() => setDependentIds((ids) => [...ids, nextDependentId.current++])}
          className="self-start rounded-lg border border-dashed border-border-strong px-3.5 py-1.5 text-xs font-bold text-muted hover:bg-background"
        >
          + Agregar dependiente
        </button>
      )}

      {state?.ok === false && "form" in state.errors && (
        <p className="text-sm text-red-600">{state.errors.form[0]}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-delta-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Comparando…" : "Generar comparativa →"}
      </button>
    </form>
  );
}
