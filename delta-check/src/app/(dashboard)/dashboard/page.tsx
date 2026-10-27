import { getAgentReport, getDashboardSummary } from "@/actions/dashboard.actions";
import { recentMonths } from "@/domains/dashboard/services/agent-report";
import { getAccess } from "@/domains/identity/services/rbac.service";
import { formatUSD } from "@/domains/shared/money";

/**
 * Bloque inicial del dashboard — mockup: `.kpi-row`/`.kpi`
 * (Cotizador-Delta-MVP-visual.html, ARCHITECTURE.md §26). Mismas 4
 * métricas que la maqueta, con números reales de `dashboardService`
 * en vez de los datos de ejemplo del mockup — `delta` es `null` cuando
 * no hay mes anterior contra qué comparar (nunca se fabrica un "0%").
 */
function Kpi({ label, value, delta }: { label: string; value: string; delta?: { percent: number | null; note: string } }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      {delta && (
        <p className={`mt-1.5 text-xs font-semibold ${delta.percent == null ? "text-muted" : delta.percent >= 0 ? "text-good" : "text-bad"}`}>
          {delta.percent == null ? delta.note : `${delta.percent >= 0 ? "↑" : "↓"} ${Math.abs(delta.percent)}% ${delta.note}`}
        </p>
      )}
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 text-sm">
            <span className="w-32 shrink-0 text-muted">{r.label}</span>
            <div className="h-2 flex-1 rounded-full bg-background">
              <div
                className="h-2 rounded-full bg-delta-blue"
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right font-semibold tabular-nums">{r.value}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted">Sin datos todavía.</p>}
      </div>
    </div>
  );
}

const RISK_HEADER = { AUTOS: "Vehículos", SALUD: "Grupos" } as const;

/** Producción por ejecutivo (BASE VEHICULOS por EJECUTIVO y MES). Filtro por GET para poder compartir el link. */
async function AgentReport({ mes, ramo, branches }: { mes?: string; ramo?: string; branches: Set<"AUTOS" | "SALUD"> }) {
  const report = await getAgentReport({ mes, ramo });
  const pct = (rate: number) => `${(rate * 100).toFixed(0)}%`;

  return (
    <section className="mb-6 rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Producción por ejecutivo · {report.month.label}
        </h2>
        <form method="get" className="flex items-center gap-2 text-sm">
          <select
            name="mes"
            defaultValue={report.month.value}
            aria-label="Mes"
            className="rounded-md border border-border bg-surface px-2 py-1"
          >
            {recentMonths(12).map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            name="ramo"
            defaultValue={report.branch ?? ""}
            aria-label="Ramo"
            className="rounded-md border border-border bg-surface px-2 py-1"
          >
            <option value="">Todos los ramos</option>
            {branches.has("AUTOS") && <option value="AUTOS">Autos</option>}
            {branches.has("SALUD") && <option value="SALUD">Salud AM</option>}
          </select>
          <button type="submit" className="rounded-md bg-delta-navy px-3 py-1 text-xs font-semibold text-white">
            Ver
          </button>
        </form>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="px-5 py-2">Ejecutivo</th>
              <th className="px-5 py-2 text-right">Cotizaciones</th>
              <th className="px-5 py-2 text-right">{report.branch ? RISK_HEADER[report.branch] : "Riesgos"}</th>
              <th className="px-5 py-2 text-right">Pólizas</th>
              <th className="px-5 py-2 text-right">Conversión</th>
              <th className="px-5 py-2 text-right">Prima emitida</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={r.agentId} className="border-b border-border last:border-0">
                <td className="px-5 py-2">{r.agentName}</td>
                <td className="px-5 py-2 text-right tabular-nums">{r.quotes}</td>
                <td className="px-5 py-2 text-right tabular-nums">{r.risks}</td>
                <td className="px-5 py-2 text-right tabular-nums">{r.policies}</td>
                <td className="px-5 py-2 text-right tabular-nums">{pct(r.conversionRate)}</td>
                <td className="px-5 py-2 text-right tabular-nums">{formatUSD(r.premiumCents)}</td>
              </tr>
            ))}
            {report.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-muted">
                  Sin cotizaciones en {report.month.label}.
                </td>
              </tr>
            ) : (
              <tr className="border-t border-border font-semibold">
                <td className="px-5 py-2">Total</td>
                <td className="px-5 py-2 text-right tabular-nums">{report.totals.quotes}</td>
                <td className="px-5 py-2 text-right tabular-nums">{report.totals.risks}</td>
                <td className="px-5 py-2 text-right tabular-nums">{report.totals.policies}</td>
                <td className="px-5 py-2 text-right tabular-nums">{pct(report.totals.conversionRate)}</td>
                <td className="px-5 py-2 text-right tabular-nums">{formatUSD(report.totals.premiumCents)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-5 py-2 text-xs text-muted">
        Solo cotizaciones enviadas (los borradores no cuentan). Pólizas y prima de las cotizaciones hechas en el mes,
        aunque se hayan emitido después.
      </p>
    </section>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ramo?: string }>;
}) {
  const { mes, ramo } = await searchParams;
  const [access, summary] = await Promise.all([getAccess(), getDashboardSummary()]);
  const branches = access?.branches ?? new Set<"AUTOS" | "SALUD">();

  if (!summary) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-sm text-muted">No tienes ningún ramo habilitado.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Métricas propias de Cotizador Delta Seguros — el Excel original no traía un tablero real que
          reproducir (hojas DASHBOARD/BASE DASHBOARD vacías).
        </p>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Cotizaciones · este mes"
          value={String(summary.monthly.quotes.total)}
          delta={{ percent: summary.monthly.quotes.deltaPercent, note: "vs. mes anterior" }}
        />
        <Kpi
          label="Pólizas emitidas · este mes"
          value={String(summary.monthly.policiesEmitidas.total)}
          delta={{ percent: summary.monthly.policiesEmitidas.deltaPercent, note: "vs. mes anterior" }}
        />
        <Kpi
          label="Renovaciones pendientes"
          value={String(summary.monthly.renovacionesProximas30Dias)}
          delta={{ percent: null, note: "próximos 30 días" }}
        />
        <Kpi
          label="Comisión generada · este mes"
          value={formatUSD(summary.monthly.comisionGeneradaCents.total)}
          delta={{ percent: summary.monthly.comisionGeneradaCents.deltaPercent, note: "vs. mes anterior" }}
        />
      </div>

      <AgentReport mes={mes} ramo={ramo} branches={branches} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card label="Cotizaciones" value={String(summary.quotes.total)} />
        <Card
          label="Conversión a póliza"
          value={`${(summary.conversion.rate * 100).toFixed(1)}%`}
          sub={`${summary.conversion.policiesEmitidas} de ${summary.conversion.quotesTotal} cotizaciones`}
        />
        <Card label="Prima vigente en cartera" value={formatUSD(summary.cartera.primaVigenteCents)} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card
          label="Pólizas vigentes"
          value={String(summary.cartera.vigentes)}
          sub={`${summary.cartera.canceladas} canceladas`}
        />
        <Card
          label="Comisiones pendientes"
          value={formatUSD(summary.comisiones.pendienteCents)}
          sub={`${formatUSD(summary.comisiones.comisionadaCents)} ya comisionadas`}
        />
        <Card label="Valor total de siniestros" value={formatUSD(summary.siniestros.valorTotalCents)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Breakdown
          title="Cotizaciones por estado"
          rows={summary.quotes.byStatus.map((r) => ({ label: r.status, value: r.total }))}
        />
        <Breakdown
          title="Cotizaciones por ramo"
          rows={summary.quotes.byBranch.map((r) => ({ label: r.branch, value: r.total }))}
        />
        <Breakdown
          title="Siniestros por estado"
          rows={summary.siniestros.byStatus.map((r) => ({ label: r.status, value: r.total }))}
        />
      </div>
    </main>
  );
}
