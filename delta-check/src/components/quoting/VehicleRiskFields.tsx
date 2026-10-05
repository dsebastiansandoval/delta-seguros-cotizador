"use client";

import { useRef } from "react";
import { PatioTuercaReferenceLink } from "@/components/shared/PatioTuercaReferenceLink";
import { usePlateLookup } from "@/components/shared/usePlateLookup";
import { ECUADOR_PROVINCES } from "@/domains/lookup/cedula.validator";

/**
 * Los campos de un vehículo (Riesgo N, EXCEL-AUDIT.md §5) — se repite una
 * vez por cada riesgo que el agente agregue (hasta 4, como el Excel).
 * Cada instancia es dueña de sus propios refs de marca/modelo/datalist —
 * a diferencia del Riesgo 1 (que vive directo en NuevaCotizacionForm
 * porque "Buscar cotización anterior" necesita escribirle desde afuera),
 * un Riesgo 2/3/4 nunca se precarga de una cotización anterior, así que
 * no hace falta exponer sus refs hacia el padre.
 */
export function VehicleRiskFields({
  suffix,
  brands,
  modelsByBrand,
}: {
  suffix: string;
  brands: string[];
  modelsByBrand: Record<string, string[]>;
}) {
  const brandRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const colorRef = useRef<HTMLInputElement>(null);
  const bodyTypeRef = useRef<HTMLSelectElement>(null);
  const modelDatalistRef = useRef<HTMLDataListElement>(null);
  const modelListId = `model-suggestions-${suffix}`;
  const plateLookup = usePlateLookup({ brandRef, modelRef, yearRef, colorRef, bodyTypeRef });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm">
        Placa
        <input
          name={`plate${suffix}`}
          placeholder="PBX-1234"
          onBlur={plateLookup.onBlur}
          className="rounded-lg border border-border bg-background px-3 py-2"
        />
        {plateLookup.pending && <p className="text-xs text-muted">Buscando…</p>}
        {plateLookup.message && (
          <p className={`text-xs ${plateLookup.message.kind === "ok" ? "text-green-700" : "text-amber-700"}`}>
            {plateLookup.message.text}
          </p>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Marca
        <select
          defaultValue=""
          onChange={(e) => {
            const brandName = e.target.value === "__OTRA__" ? "" : e.target.value;
            if (brandRef.current) brandRef.current.value = brandName;
            if (modelDatalistRef.current) {
              modelDatalistRef.current.replaceChildren(
                ...(modelsByBrand[brandName] ?? []).map((model) => {
                  const option = document.createElement("option");
                  option.value = model;
                  return option;
                }),
              );
            }
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
          name={`brand${suffix}`}
          placeholder="Marca"
          className="rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Modelo
        <input
          ref={modelRef}
          name={`model${suffix}`}
          list={modelListId}
          placeholder="Escribe o elige de la lista al seleccionar marca"
          className="rounded-lg border border-border bg-background px-3 py-2"
        />
        <datalist ref={modelDatalistRef} id={modelListId} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Año
        <input
          ref={yearRef}
          name={`year${suffix}`}
          type="number"
          defaultValue={new Date().getFullYear()}
          className="rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Tipo
        <select
          ref={bodyTypeRef}
          name={`bodyType${suffix}`}
          defaultValue="LIVIANO"
          className="rounded-lg border border-border bg-background px-3 py-2"
        >
          <option value="LIVIANO">Liviano</option>
          <option value="PICKUP">Pickup</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Color
        <input ref={colorRef} name={`color${suffix}`} className="rounded-lg border border-border bg-background px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Valor comercial (USD)
        <input
          name={`commercialValueDollars${suffix}`}
          type="number"
          step="0.01"
          className="rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>

      <div className="flex items-end">
        <PatioTuercaReferenceLink brandRef={brandRef} modelRef={modelRef} yearRef={yearRef} />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Extras (USD)
        <input
          name={`extrasValueDollars${suffix}`}
          type="number"
          step="0.01"
          defaultValue={0}
          className="rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Provincia
        <select name={`province${suffix}`} defaultValue="" className="rounded-lg border border-border bg-background px-3 py-2">
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
        <input name={`city${suffix}`} className="rounded-lg border border-border bg-background px-3 py-2" />
      </label>

      <label className="col-span-full flex items-center gap-2 text-sm">
        <input name={`hasTracker${suffix}`} type="checkbox" value="true" />
        Tiene dispositivo de rastreo
      </label>
    </div>
  );
}
