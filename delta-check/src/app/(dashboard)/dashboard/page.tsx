import { getDashboardSummary } from "@/actions/dashboard.actions";
import { formatUSD } from "@/domains/shared/money";

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

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  return (
    <main className="mx-auto max-w-5xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Métricas propias de Delta Check — el Excel original no traía un tablero real que
          reproducir (hojas DASHBOARD/BASE DASHBOARD vacías).
        </p>
      </header>

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
