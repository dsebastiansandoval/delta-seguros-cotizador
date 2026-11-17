"use client";

import { useActionState, useRef, useState } from "react";
import { updateHealthQuote } from "@/actions/health-quote.actions";
import type { ActionResult } from "@/actions/quote.actions";
import { useDocumentLookup } from "@/components/shared/useDocumentLookup";
import { useGenderSuggestion } from "@/components/shared/useGenderSuggestion";
import { AgeOrBirthDateField } from "@/components/shared/AgeOrBirthDateField";
import { MAX_DEPENDENTS } from "@/domains/health/schemas/health-quote.schema";

const initialState: ActionResult<{ quoteId: string }> | null = null;

type Dependent = { age: number; gender: "MASCULINO" | "FEMENINO"; birthDate: string | null };

function DependentFields({
  fieldNumber,
  defaultValue,
  onRemove,
}: {
  fieldNumber: number;
  defaultValue?: Dependent;
  onRemove?: () => void;
}) {
  return (
    <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-border pt-4">
      <div className="col-span-full flex items-center justify-between">
        <legend className="text-sm font-semibold">Dependiente {fieldNumber}</legend>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-xs font-semibold text-link underline">
            Retirar
          </button>
        )}
      </div>
      <AgeOrBirthDateField
        namePrefix={`dep${fieldNumber}`}
        defaultAge={defaultValue?.age}
        defaultBirthDate={defaultValue?.birthDate}
      />
      <label className="flex flex-col gap-1 text-sm">
        Sexo
        <select
          name={`dep${fieldNumber}Gender`}
          defaultValue={defaultValue?.gender ?? ""}
          className="rounded-lg border border-border bg-surface px-3 py-2"
        >
          <option value="">—</option>
          <option value="MASCULINO">Masculino</option>
          <option value="FEMENINO">Femenino</option>
        </select>
      </label>
    </fieldset>
  );
}

/**
 * Edición completa de una cotización de Salud BORRADOR — mismos campos
 * que NuevaCotizacionSaludForm (puede agregar/quitar dependientes,
 * cambiar región), pero precargada y apuntando a updateHealthQuote en
 * vez de createHealthQuote. Solo se usa mientras sigue BORRADOR — una
 * vez enviada, la página cae a EditHealthClientForm (más angosto).
 */
export function EditHealthQuoteForm({
  quoteId,
  vendors,
  currentVendor,
  vendorMode,
  client,
  titular,
  region,
  dependents,
}: {
  quoteId: string;
  vendors: string[];
  currentVendor: string;
  vendorMode: "free" | "select" | "locked";
  client: { documentType: string; documentNumber: string; firstName: string | null; lastName: string | null };
  titular: { age: number; gender: "MASCULINO" | "FEMENINO"; birthDate: string | null };
  region: "SIERRA" | "COSTA" | "AUSTRO";
  dependents: Dependent[];
}) {
  const [state, formAction, pending] = useActionState(updateHealthQuote, initialState);
  const documentTypeRef = useRef<HTMLSelectElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const provinceRef = useRef<HTMLInputElement>(null);
  const titularGenderRef = useRef<HTMLSelectElement>(null);
  const [titularAutoBirthDate, setTitularAutoBirthDate] = useState<string | null>(null);
  const documentLookup = useDocumentLookup({
    documentTypeRef,
    firstNameRef,
    lastNameRef,
    provinceRef,
    onBirthDate: setTitularAutoBirthDate,
  });
  const genderSuggestion = useGenderSuggestion(titularGenderRef);

  const [dependentIds, setDependentIds] = useState<number[]>(() =>
    dependents.length ? dependents.map((_, i) => i + 1) : [1],
  );
  const nextDependentId = useRef(dependentIds.length + 1);
  const [vendorCustom, setVendorCustom] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="quoteId" value={quoteId} />

      {state?.ok === false && "form" in state.errors && (
        <p className="rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-400">
          {state.errors.form[0]}
        </p>
      )}

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          Vendedor
          {vendorMode === "locked" ? (
            <input name="vendor" defaultValue={currentVendor} readOnly className="rounded-lg border border-border bg-background px-3 py-2 text-muted" />
          ) : vendorMode === "free" && vendorCustom ? (
            <>
              <input
                name="vendor"
                defaultValue={currentVendor}
                placeholder="Escribe el nombre"
                autoComplete="off"
                className="rounded-lg border border-border bg-surface px-3 py-2"
              />
              <button type="button" onClick={() => setVendorCustom(false)} className="self-start text-xs text-link underline">
                Volver a la lista
              </button>
            </>
          ) : (
            <select
              name="vendor"
              defaultValue={currentVendor}
              onChange={(e) => {
                if (e.target.value === "__otro__") setVendorCustom(true);
              }}
              className="rounded-lg border border-border bg-surface px-3 py-2"
            >
              {vendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
              {vendorMode === "free" && <option value="__otro__">+ Escribir otro nombre…</option>}
            </select>
          )}
        </label>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <legend className="col-span-full text-sm font-semibold">Cliente</legend>
        <label className="flex flex-col gap-1 text-sm">
          Tipo de documento
          <select
            ref={documentTypeRef}
            name="documentType"
            defaultValue={client.documentType}
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
            defaultValue={client.documentNumber}
            onBlur={documentLookup.onBlur}
            className="rounded-lg border border-border bg-surface px-3 py-2"
          />
          {documentLookup.pending && <p className="text-xs text-muted">Buscando…</p>}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Provincia
          <input ref={provinceRef} readOnly placeholder="—" className="rounded-lg border border-border bg-surface px-3 py-2 text-muted" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Nombres
          <input
            ref={firstNameRef}
            name="firstName"
            defaultValue={client.firstName ?? ""}
            onBlur={(e) => genderSuggestion.onFirstNameBlur(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Apellidos
          <input ref={lastNameRef} name="lastName" defaultValue={client.lastName ?? ""} className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Región
          <select name="region" defaultValue={region} className="rounded-lg border border-border bg-surface px-3 py-2">
            <option value="SIERRA">Sierra</option>
            <option value="COSTA">Costa</option>
            <option value="AUSTRO">Austro</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="col-span-full text-sm font-semibold">Titular</legend>
        <AgeOrBirthDateField
          namePrefix="titular"
          required
          autoBirthDate={titularAutoBirthDate}
          defaultAge={titular.age}
          defaultBirthDate={titular.birthDate}
        />
        <label className="flex flex-col gap-1 text-sm">
          Sexo
          <select
            ref={titularGenderRef}
            name="titularGender"
            required
            defaultValue={titular.gender}
            onChange={genderSuggestion.onGenderChange}
            className="rounded-lg border border-border bg-surface px-3 py-2"
          >
            <option value="MASCULINO">Masculino</option>
            <option value="FEMENINO">Femenino</option>
          </select>
          {genderSuggestion.suggested && <p className="text-xs text-muted">Sugerido según el nombre — puedes cambiarlo</p>}
        </label>
      </fieldset>

      {dependentIds.map((id, index) => (
        <DependentFields
          key={id}
          fieldNumber={index + 1}
          defaultValue={dependents[index]}
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

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-delta-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
