"use client";

import { useActionState, useRef } from "react";
import { createAutoQuote, type ActionResult } from "@/actions/quote.actions";
import { CedulaLookupButton } from "@/components/shared/CedulaLookupButton";

const initialState: ActionResult<{ quoteId: string }> | null = null;

function FieldError({ errors, name }: { errors: Extract<ActionResult, { ok: false }>["errors"] | undefined; name: string }) {
  if (!errors || "form" in errors) return null;
  const fieldErrors = errors[name];
  if (!fieldErrors?.length) return null;
  return <p className="text-xs text-red-600">{fieldErrors[0]}</p>;
}

export function NuevaCotizacionForm({ brands }: { brands: string[] }) {
  const [state, formAction, pending] = useActionState(createAutoQuote, initialState);
  const documentNumberRef = useRef<HTMLInputElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const brandRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <legend className="col-span-full text-sm font-semibold">Modalidad</legend>
        <label className="flex flex-col gap-1 text-sm">
          Tipo de póliza
          <select name="modality" defaultValue="ANUAL" className="rounded-lg border border-border bg-background px-3 py-2">
            <option value="ANUAL">Anual</option>
            <option value="POR_KM">Auto x Km</option>
          </select>
        </label>
      </fieldset>

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
          <FieldError errors={state?.ok === false ? state.errors : undefined} name="documentNumber" />
        </label>

        <div className="flex items-end">
          <CedulaLookupButton
            documentNumberRef={documentNumberRef}
            firstNameRef={firstNameRef}
            lastNameRef={lastNameRef}
          />
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Nombres
          <input ref={firstNameRef} name="firstName" className="rounded-lg border border-border bg-background px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Apellidos
          <input ref={lastNameRef} name="lastName" className="rounded-lg border border-border bg-background px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Fuente
          <input name="source" className="rounded-lg border border-border bg-background px-3 py-2" />
        </label>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <legend className="col-span-full text-sm font-semibold">Vehículo (Riesgo 1)</legend>

        <label className="flex flex-col gap-1 text-sm">
          Placa
          <input name="plate" required placeholder="PBX-1234" className="rounded-lg border border-border bg-background px-3 py-2" />
          <FieldError errors={state?.ok === false ? state.errors : undefined} name="plate" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Marca
          <select
            defaultValue=""
            onChange={(e) => {
              if (brandRef.current) brandRef.current.value = e.target.value === "__OTRA__" ? "" : e.target.value;
            }}
            className="rounded-lg border border-border bg-background px-3 py-2"
          >
            <option value="" disabled>
              Selecciona una marca
            </option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
            <option value="__OTRA__">Otra (especificar abajo)</option>
          </select>
          <input
            ref={brandRef}
            name="brand"
            required
            placeholder="Marca"
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Modelo
          <input name="model" required className="rounded-lg border border-border bg-background px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Año
          <input name="year" type="number" required defaultValue={new Date().getFullYear()} className="rounded-lg border border-border bg-background px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Tipo
          <select name="bodyType" defaultValue="LIVIANO" className="rounded-lg border border-border bg-background px-3 py-2">
            <option value="LIVIANO">Liviano</option>
            <option value="PICKUP">Pickup</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Color
          <input name="color" className="rounded-lg border border-border bg-background px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Valor comercial (USD)
          <input name="commercialValueDollars" type="number" step="0.01" required className="rounded-lg border border-border bg-background px-3 py-2" />
          <FieldError errors={state?.ok === false ? state.errors : undefined} name="commercialValueDollars" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Extras (USD)
          <input name="extrasValueDollars" type="number" step="0.01" defaultValue={0} className="rounded-lg border border-border bg-background px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Ciudad
          <input name="city" className="rounded-lg border border-border bg-background px-3 py-2" />
        </label>

        <label className="col-span-full flex items-center gap-2 text-sm">
          <input name="hasTracker" type="checkbox" value="true" />
          Tiene dispositivo de rastreo
        </label>
      </fieldset>

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
