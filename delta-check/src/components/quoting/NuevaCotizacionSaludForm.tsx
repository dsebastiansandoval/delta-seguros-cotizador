"use client";

import { useActionState, useRef } from "react";
import { createHealthQuote } from "@/actions/health-quote.actions";
import type { ActionResult } from "@/actions/quote.actions";
import { CedulaLookupButton } from "@/components/shared/CedulaLookupButton";

const initialState: ActionResult<{ quoteId: string }> | null = null;

function DependentFields({ n }: { n: 1 | 2 | 3 }) {
  return (
    <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-border pt-4">
      <legend className="col-span-full text-sm font-semibold">Dependiente {n}</legend>
      <label className="flex flex-col gap-1 text-sm">
        Fecha de nacimiento
        <input name={`dep${n}BirthDate`} type="date" className="rounded-lg border border-border bg-background px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Sexo
        <select name={`dep${n}Gender`} defaultValue="" className="rounded-lg border border-border bg-background px-3 py-2">
          <option value="">—</option>
          <option value="MASCULINO">Masculino</option>
          <option value="FEMENINO">Femenino</option>
        </select>
      </label>
    </fieldset>
  );
}

export function NuevaCotizacionSaludForm() {
  const [state, formAction, pending] = useActionState(createHealthQuote, initialState);
  const documentNumberRef = useRef<HTMLInputElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const provinceRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <legend className="col-span-full text-sm font-semibold">Cliente</legend>
        <label className="flex flex-col gap-1 text-sm">
          Tipo de persona
          <select name="personType" defaultValue="NATURAL" className="rounded-lg border border-border bg-background px-3 py-2">
            <option value="NATURAL">Natural</option>
            <option value="JURIDICA">Jurídica</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tipo de documento
          <select name="documentType" defaultValue="CEDULA" className="rounded-lg border border-border bg-background px-3 py-2">
            <option value="CEDULA">Cédula</option>
            <option value="RUC">RUC</option>
            <option value="PASAPORTE">Pasaporte</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Documento
          <input
            ref={documentNumberRef}
            name="documentNumber"
            required
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
        <div className="flex items-end">
          <CedulaLookupButton
            documentNumberRef={documentNumberRef}
            firstNameRef={firstNameRef}
            lastNameRef={lastNameRef}
            provinceRef={provinceRef}
          />
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Provincia (según cédula)
          <input
            ref={provinceRef}
            readOnly
            placeholder="—"
            className="rounded-lg border border-border bg-background px-3 py-2 text-muted"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Nombres
          <input ref={firstNameRef} name="firstName" className="rounded-lg border border-border bg-background px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Apellidos
          <input ref={lastNameRef} name="lastName" className="rounded-lg border border-border bg-background px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Región
          <select name="region" defaultValue="SIERRA" className="rounded-lg border border-border bg-background px-3 py-2">
            <option value="SIERRA">Sierra</option>
            <option value="COSTA">Costa</option>
            <option value="AUSTRO">Austro</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="col-span-full text-sm font-semibold">Titular</legend>
        <label className="flex flex-col gap-1 text-sm">
          Fecha de nacimiento
          <input
            name="titularBirthDate"
            type="date"
            required
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Sexo
          <select name="titularGender" defaultValue="MASCULINO" className="rounded-lg border border-border bg-background px-3 py-2">
            <option value="MASCULINO">Masculino</option>
            <option value="FEMENINO">Femenino</option>
          </select>
        </label>
      </fieldset>

      <DependentFields n={1} />
      <DependentFields n={2} />
      <DependentFields n={3} />

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
