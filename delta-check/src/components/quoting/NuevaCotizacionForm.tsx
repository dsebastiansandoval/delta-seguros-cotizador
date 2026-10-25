"use client";

import { useActionState, useRef, useState } from "react";
import { createAutoQuote, saveAutoQuoteDraft, type ActionResult } from "@/actions/quote.actions";
import { useDocumentLookup } from "@/components/shared/useDocumentLookup";
import { usePlateLookup } from "@/components/shared/usePlateLookup";
import { PatioTuercaReferenceLink } from "@/components/shared/PatioTuercaReferenceLink";
import { RenewalLookupButton } from "@/components/shared/RenewalLookupButton";
import { VehicleRiskFields } from "@/components/quoting/VehicleRiskFields";
import { ECUADOR_PROVINCES } from "@/domains/lookup/cedula.validator";

const initialState: ActionResult<{ quoteId: string }> | null = null;

function FieldError({ errors, name }: { errors: Extract<ActionResult, { ok: false }>["errors"] | undefined; name: string }) {
  if (!errors || "form" in errors) return null;
  const fieldErrors = errors[name];
  if (!fieldErrors?.length) return null;
  return <p className="text-xs text-red-600">{fieldErrors[0]}</p>;
}

export function NuevaCotizacionForm({
  brands,
  modelsByBrand,
  sources,
  executives,
}: {
  brands: string[];
  /** Modelo en cascada según la marca — ver ModeloDatalist más abajo. */
  modelsByBrand: Record<string, string[]>;
  /** FUENTE del Excel (INFO GENERAL!T15:T43) — ver listQuoteSources(). */
  sources: string[];
  /** EJECUTIVO del Excel (INFO GENERAL!Y15:Y19) — ver listQuoteExecutives(). */
  executives: string[];
}) {
  const [state, formAction, pending] = useActionState(createAutoQuote, initialState);
  const [draftState, draftAction, draftPending] = useActionState(saveAutoQuoteDraft, initialState);
  const documentNumberRef = useRef<HTMLInputElement>(null);
  const documentTypeRef = useRef<HTMLSelectElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const provinceRef = useRef<HTMLInputElement>(null);
  const brandRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLInputElement>(null);
  const modelDatalistRef = useRef<HTMLDataListElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const plateRef = useRef<HTMLInputElement>(null);
  const bodyTypeRef = useRef<HTMLSelectElement>(null);
  const colorRef = useRef<HTMLInputElement>(null);
  const commercialValueRef = useRef<HTMLInputElement>(null);
  const extrasValueRef = useRef<HTMLInputElement>(null);
  const hasTrackerRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const vehicleProvinceRef = useRef<HTMLSelectElement>(null);
  const operationTypeRef = useRef<HTMLSelectElement>(null);
  const previousInsurerIdRef = useRef<HTMLInputElement>(null);
  const previousPolicyNumberRef = useRef<HTMLInputElement>(null);
  const previousExpiryDateRef = useRef<HTMLInputElement>(null);
  const documentLookup = useDocumentLookup({ documentTypeRef, firstNameRef, lastNameRef, provinceRef });
  const plateLookup = usePlateLookup({ brandRef, modelRef, yearRef, colorRef, bodyTypeRef, provinceRef: vehicleProvinceRef });

  // Riesgo 1 siempre existe; Riesgo 2/3/4 son bloques que el agente agrega
  // a mano — mismos radio buttons "RIESGO 1..4" del Excel (EXCEL-AUDIT.md
  // §5), acá como tabs. `riskCount` cuántos bloques existen, `activeTab`
  // cuál se ve — los que no están activos siguen montados (con `hidden`,
  // no desmontados) para no perder lo ya escrito ahí.
  const [riskCount, setRiskCount] = useState(1);
  const [activeTab, setActiveTab] = useState(1);

  const errors = state?.ok === false ? state.errors : undefined;
  const formError = draftState?.ok === false && "form" in draftState.errors ? draftState.errors.form[0] : undefined;

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

        <label className="flex flex-col gap-1 text-sm">
          Tipo de operación
          <select
            ref={operationTypeRef}
            name="operationType"
            defaultValue="NUEVA"
            className="rounded-lg border border-border bg-background px-3 py-2"
          >
            <option value="NUEVA">Nueva</option>
            <option value="RENOVACION">Renovación</option>
          </select>
        </label>
        {/* CIA ANTERIOR / No. POLIZA / FIN VIGENCIA del Excel — se llenan
            solos con "Buscar cotización anterior", quedan ocultos porque
            no hace falta que el ejecutivo los toque a mano. */}
        <input ref={previousInsurerIdRef} type="hidden" name="previousInsurerId" />
        <input ref={previousPolicyNumberRef} type="hidden" name="previousPolicyNumber" />
        <input ref={previousExpiryDateRef} type="hidden" name="previousExpiryDate" />
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
          <select
            ref={documentTypeRef}
            name="documentType"
            defaultValue="CEDULA"
            className="rounded-lg border border-border bg-background px-3 py-2"
          >
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
            onBlur={documentLookup.onBlur}
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
          <FieldError errors={errors} name="documentNumber" />
          {documentLookup.pending && <p className="text-xs text-muted">Buscando…</p>}
          {documentLookup.message && (
            <p className={`text-xs ${documentLookup.message.kind === "ok" ? "text-green-700" : "text-amber-700"}`}>
              {documentLookup.message.text}
            </p>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Provincia (según cédula)
          <input
            ref={provinceRef}
            readOnly
            placeholder="—"
            className="rounded-lg border border-border bg-background px-3 py-2 text-muted"
          />
        </label>

        <div className="flex items-end">
          <RenewalLookupButton
            documentNumberRef={documentNumberRef}
            plateRef={plateRef}
            brandRef={brandRef}
            modelRef={modelRef}
            yearRef={yearRef}
            bodyTypeRef={bodyTypeRef}
            colorRef={colorRef}
            commercialValueRef={commercialValueRef}
            extrasValueRef={extrasValueRef}
            hasTrackerRef={hasTrackerRef}
            cityRef={cityRef}
            provinceRef={vehicleProvinceRef}
            operationTypeRef={operationTypeRef}
            previousInsurerIdRef={previousInsurerIdRef}
            previousPolicyNumberRef={previousPolicyNumberRef}
            previousExpiryDateRef={previousExpiryDateRef}
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
          <input
            name="source"
            list="sources-datalist"
            placeholder="Escribe o elige de la lista"
            autoComplete="off"
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
          <datalist id="sources-datalist">
            {sources.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Ejecutivo
          <input
            name="executive"
            list="executives-datalist"
            placeholder="Escribe o elige de la lista"
            autoComplete="off"
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
          <datalist id="executives-datalist">
            {executives.map((ex) => (
              <option key={ex} value={ex} />
            ))}
          </datalist>
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold">Vehículo</legend>

        <div className="flex flex-wrap gap-2">
          {Array.from({ length: riskCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setActiveTab(n)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold ${
                activeTab === n ? "bg-delta-navy text-white" : "border border-border bg-background text-muted"
              }`}
            >
              Riesgo {n}
            </button>
          ))}
          {riskCount < 4 && (
            <button
              type="button"
              onClick={() => {
                const next = riskCount + 1;
                setRiskCount(next);
                setActiveTab(next);
              }}
              className="rounded-lg border border-dashed border-border-strong px-3.5 py-1.5 text-xs font-bold text-muted hover:bg-background"
            >
              + Añadir riesgo
            </button>
          )}
          {riskCount > 1 && (
            <button
              type="button"
              onClick={() => {
                const next = riskCount - 1;
                setRiskCount(next);
                setActiveTab((t) => (t > next ? next : t));
              }}
              className="rounded-lg px-3.5 py-1.5 text-xs font-bold text-link underline"
            >
              Quitar riesgo {riskCount}
            </button>
          )}
        </div>

        <div hidden={activeTab !== 1} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Placa
            <input
              ref={plateRef}
              name="plate1"
              required
              placeholder="PBX-1234"
              onBlur={plateLookup.onBlur}
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
            <FieldError errors={errors} name="plate1" />
            {plateLookup.pending && <p className="text-xs text-muted">Buscando…</p>}
            {plateLookup.message && (
              <p className={`text-xs ${plateLookup.message.kind === "ok" ? "text-green-700" : "text-amber-700"}`}>
                {plateLookup.message.text}
              </p>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Marca
            <input
              ref={brandRef}
              name="brand1"
              list="brand-suggestions-1"
              required
              placeholder="Escribe o elige de la lista"
              autoComplete="off"
              onChange={(e) => {
                if (modelDatalistRef.current) {
                  modelDatalistRef.current.replaceChildren(
                    ...(modelsByBrand[e.target.value] ?? []).map((model) => {
                      const option = document.createElement("option");
                      option.value = model;
                      return option;
                    }),
                  );
                }
              }}
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
            <datalist id="brand-suggestions-1">
              {brands.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Modelo
            <input
              ref={modelRef}
              name="model1"
              list="model-suggestions-1"
              required
              placeholder="Escribe o elige de la lista al seleccionar marca"
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
            <datalist ref={modelDatalistRef} id="model-suggestions-1" />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Año
            <input
              ref={yearRef}
              name="year1"
              type="number"
              required
              defaultValue={new Date().getFullYear()}
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Tipo
            <select
              ref={bodyTypeRef}
              name="bodyType1"
              defaultValue="LIVIANO"
              className="rounded-lg border border-border bg-background px-3 py-2"
            >
              <option value="LIVIANO">Liviano</option>
              <option value="PICKUP">Pickup</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Color
            <input ref={colorRef} name="color1" className="rounded-lg border border-border bg-background px-3 py-2" />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Valor comercial (USD)
            <input
              ref={commercialValueRef}
              name="commercialValueDollars1"
              type="number"
              step="0.01"
              required
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
            <FieldError errors={errors} name="commercialValueDollars1" />
          </label>

          <div className="flex items-end">
            <PatioTuercaReferenceLink brandRef={brandRef} modelRef={modelRef} yearRef={yearRef} modelsByBrand={modelsByBrand} />
          </div>

          <label className="flex flex-col gap-1 text-sm">
            Extras (USD)
            <input
              ref={extrasValueRef}
              name="extrasValueDollars1"
              type="number"
              step="0.01"
              defaultValue={0}
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Provincia
            <select
              ref={vehicleProvinceRef}
              name="province1"
              defaultValue=""
              className="rounded-lg border border-border bg-background px-3 py-2"
            >
              <option value="">Selecciona una provincia</option>
              {ECUADOR_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Ciudad
            <input ref={cityRef} name="city1" className="rounded-lg border border-border bg-background px-3 py-2" />
          </label>

          <label className="col-span-full flex items-center gap-2 text-sm">
            <input ref={hasTrackerRef} name="hasTracker1" type="checkbox" value="true" />
            Tiene dispositivo de rastreo
          </label>
        </div>

        {[2, 3, 4].map(
          (n) =>
            riskCount >= n && (
              <div key={n} hidden={activeTab !== n}>
                <VehicleRiskFields suffix={String(n)} brands={brands} modelsByBrand={modelsByBrand} />
              </div>
            ),
        )}
      </fieldset>

      {formError && <p className="text-sm text-red-600">{formError}</p>}
      {state?.ok === false && "form" in state.errors && (
        <p className="text-sm text-red-600">{state.errors.form[0]}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          formAction={draftAction}
          disabled={draftPending || pending}
          className="self-start rounded-lg border border-border-strong px-5 py-2.5 text-sm font-semibold text-foreground disabled:opacity-60"
        >
          {draftPending ? "Guardando…" : "Guardar borrador"}
        </button>
        <button
          type="submit"
          disabled={pending || draftPending}
          className="self-start rounded-lg bg-delta-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Comparando…" : "Generar comparativa →"}
        </button>
      </div>
    </form>
  );
}
