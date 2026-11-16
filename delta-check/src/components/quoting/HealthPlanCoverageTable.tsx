import { Fragment } from "react";
import { formatCoverageValue } from "@/domains/health/services/health-offer-format";
import type { HealthPlanCoverageRow } from "@/domains/quoting/services/quote-coverage.service";

/**
 * Catálogo real de coberturas del plan (`health_plan_coverages`), de solo
 * lectura — Salud no usa la grilla manual genérica de Autos (ver
 * `getQuoteOptionCoverages`, `mode: "CATALOG"`): este dato es por
 * aseguradora+plan, no por cotización, así que se edita en el catálogo, no
 * acá.
 */
export function HealthPlanCoverageTable({ rows }: { rows: HealthPlanCoverageRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted">
        Esta aseguradora/plan todavía no tiene la grilla de coberturas cargada en el catálogo.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => {
            const showSection = i === 0 || r.section !== rows[i - 1].section;
            return (
              <Fragment key={r.label}>
                {showSection && (
                  <tr className="bg-delta-navy text-white">
                    <th colSpan={2} className="px-4 py-1.5 text-left text-xs font-bold uppercase tracking-wide">
                      {r.section.replace(/_/g, " ")}
                    </th>
                  </tr>
                )}
                <tr className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.label}</td>
                  <td className="px-4 py-3 text-muted">{formatCoverageValue(r)}</td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
