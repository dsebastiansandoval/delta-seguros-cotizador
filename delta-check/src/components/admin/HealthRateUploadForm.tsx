"use client";

import { useActionState, useState } from "react";
import { uploadHealthRates, type HealthRateUploadResult } from "@/actions/health-rate.actions";
import type { ActionResult } from "@/actions/quote.actions";
import { parseHealthRateCsv, type HealthRateCsvResult } from "@/domains/health/services/health-rate-csv";

export type UploadInsurer = { id: string; name: string; ratedPlanCodes: string[]; currentPlanCodes: string[] };

const inputClass = "rounded-md border border-border bg-surface px-2 py-1 text-sm";

/**
 * La vista previa se calcula en el navegador con el mismo parser que usa el
 * servidor, así el ADMIN ve los errores fila por fila antes de guardar. El
 * servidor vuelve a validar: la vista previa es solo una ayuda.
 */
export function HealthRateUploadForm({ insurers, today }: { insurers: UploadInsurer[]; today: string }) {
  const [state, formAction, pending] = useActionState<ActionResult<HealthRateUploadResult> | null, FormData>(
    uploadHealthRates,
    null,
  );
  const [insurerId, setInsurerId] = useState(insurers[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<HealthRateCsvResult | null>(null);
  const [lastSaved, setLastSaved] = useState<HealthRateUploadResult | null>(null);

  // Tras guardar, el form se resetea: se limpia la vista previa del archivo anterior.
  if (state?.ok && state.value !== lastSaved) {
    setLastSaved(state.value);
    setFile(null);
    setPreview(null);
  }

  const insurer = insurers.find((i) => i.id === insurerId);

  async function refreshPreview(nextFile: File | null, nextInsurer = insurer) {
    setFile(nextFile);
    if (!nextFile || !nextInsurer) return setPreview(null);
    setPreview(
      parseHealthRateCsv(await nextFile.text(), {
        validPlanCodes: nextInsurer.ratedPlanCodes,
        currentPlanCodes: nextInsurer.currentPlanCodes,
      }),
    );
  }

  const plans = preview ? new Set(preview.rows.map((r) => r.planCode)).size : 0;
  const serverErrors = state?.ok === false ? Object.values(state.errors).flat() : [];

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Aseguradora
          <select
            name="insurerId"
            value={insurerId}
            onChange={(e) => {
              setInsurerId(e.target.value);
              void refreshPreview(file, insurers.find((i) => i.id === e.target.value));
            }}
            className={inputClass}
          >
            {insurers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Vigente desde
          <input name="validFrom" type="date" required defaultValue={today} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Archivo CSV
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            onChange={(e) => void refreshPreview(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !preview || preview.errors.length > 0}
          className="rounded-md bg-delta-navy px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Cargando…" : "Cargar tarifas"}
        </button>
      </div>

      {preview && preview.errors.length === 0 && (
        <div className="rounded-md border border-border bg-background px-3 py-2 text-sm">
          <p>
            <span className="font-semibold">{preview.rows.length.toLocaleString("es-EC")} tarifas</span> de {plans}{" "}
            {plans === 1 ? "plan" : "planes"} para {insurer?.name}. Reemplaza la tabla de esa aseguradora desde la fecha
            indicada; las cotizaciones ya hechas no cambian.
          </p>
          {preview.missingPlans.length > 0 && (
            <p className="mt-1 text-warn">
              Estos planes de la tabla vigente no vienen en el archivo y dejarán de cotizarse:{" "}
              {preview.missingPlans.join(", ")}
            </p>
          )}
        </div>
      )}

      {preview && preview.errors.length > 0 && (
        <div className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad">
          <p className="font-semibold">Corrige el archivo antes de cargarlo:</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {preview.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {serverErrors.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-bad">
          {serverErrors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      {state?.ok && (
        <p className="text-sm font-semibold text-good">
          {state.value.replaced ? "Reemplazada" : "Cargada"} la tabla de {state.value.insurerName} vigente desde{" "}
          {state.value.validFrom}: {state.value.rules.toLocaleString("es-EC")} tarifas, {state.value.plans}{" "}
          {state.value.plans === 1 ? "plan" : "planes"}.
        </p>
      )}
    </form>
  );
}
