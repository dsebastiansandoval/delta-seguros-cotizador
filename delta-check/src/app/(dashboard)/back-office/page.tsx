import Link from "next/link";
import type { ReactNode } from "react";
import { getBackOfficeOverview } from "@/actions/back-office.actions";
import {
  BACK_OFFICE_BASES,
  BASE_LABELS,
  clientDisplayName,
  DUE_SOON_DAYS,
  share,
} from "@/domains/backoffice/services/back-office";
import { recentMonths } from "@/domains/dashboard/services/agent-report";
import { getAccess } from "@/domains/identity/services/rbac.service";
import { formatUSD } from "@/domains/shared/money";

const CLAIM_LABEL: Record<string, string> = { REPORTADO: "Reportado", APROBADO: "Aprobado", REPARADO: "Reparado" };

/** Tarjeta de "Módulos de gestión interna" (Cotizador-Delta-MVP-visual.html, `.module-card`). */
function ModuleCard({
  title,
  sub,
  rows,
}: {
  title: string;
  sub: ReactNode;
  rows: Array<{ label: string; width: number; value: string }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <p className="text-sm font-bold">{title}</p>
      <div className="mb-3.5 mt-1 text-xs text-muted">{sub}</div>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2.5 text-xs text-muted">
            <span className="w-24 shrink-0 truncate">{r.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background">
              <div className="h-full rounded-full bg-delta-blue" style={{ width: `${r.width}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right tabular-nums">{r.value}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-xs text-muted">Sin datos todavía.</p>}
      </div>
    </div>
  );
}

function Queue({ title, hint, count, children }: { title: string; hint: string; count: number; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface shadow-sm">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          {title} <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-foreground">{count}</span>
        </h2>
        <p className="mt-0.5 text-xs text-muted">{hint}</p>
      </div>
      {count === 0 ? <p className="px-5 py-4 text-sm text-muted">Nada pendiente.</p> : <div className="overflow-x-auto">{children}</div>}
    </section>
  );
}

const th = "px-5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted";
const td = "px-5 py-2";

function PolicyLink({ id, number }: { id: string; number: string | null }) {
  return (
    <Link href={`/cartera/${id}`} className="font-medium text-link underline">
      {number || "(sin número)"}
    </Link>
  );
}

export default async function BackOfficePage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const access = await getAccess();
  if (!access?.permissions.has("quote:read_all")) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-xl font-bold tracking-tight">Sin acceso</h1>
        <p className="mt-2 text-sm text-muted">El back-office lo ven supervisores y administradores.</p>
      </main>
    );
  }

  const { mes } = await searchParams;
  const { month, overview } = await getBackOfficeOverview({ mes });
  if (!overview) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-xl font-bold tracking-tight">Back-office</h1>
        <p className="mt-2 text-sm text-muted">No tienes ningún ramo habilitado.</p>
      </main>
    );
  }

  const { issueSummary: s, claimsByStatus, pendingIssues, dueInstallments, pendingCancellations, commissions } = overview;
  const totalPolicies = s.emitidas + s.enTramite + s.noEmitidas + s.canceladas;
  const issueRows = [
    { label: "Emitidas", n: s.emitidas },
    { label: "En trámite", n: s.enTramite },
    ...(s.noEmitidas ? [{ label: "No emitidas", n: s.noEmitidas }] : []),
    { label: "Canceladas", n: s.canceladas },
  ].map((r) => ({ label: r.label, width: share(r.n, totalPolicies), value: `${share(r.n, totalPolicies)}% · ${r.n}` }));

  const maxClaims = Math.max(1, ...claimsByStatus.map((c) => c.total));
  const claimRows = ["REPORTADO", "APROBADO", "REPARADO"].map((status) => {
    const n = claimsByStatus.find((c) => c.status === status)?.total ?? 0;
    return { label: CLAIM_LABEL[status], width: share(n, maxClaims), value: String(n) };
  });

  const maxCommission = Math.max(1, ...(commissions?.byInsurer ?? []).map((r) => r.amountCents));
  const commissionRows = (commissions?.byInsurer ?? []).slice(0, 6).map((r) => ({
    label: r.insurerName,
    width: share(r.amountCents, maxCommission),
    value: formatUSD(r.amountCents),
  }));

  const overdue = dueInstallments.filter((i) => i.urgency === "VENCIDA");
  const overdueCents = overdue.reduce((sum, i) => sum + i.amountCents, 0);

  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Back-office</h1>
        <p className="mt-1 text-sm text-muted">
          Lo que en el Excel se seguía en las hojas BASE: qué falta emitir, cobrar, cancelar y comisionar, de todas las
          pólizas. Cada cambio se hace en el detalle de la póliza.
        </p>
      </header>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <ModuleCard title="Emisiones & pendientes" sub="Estado de trámite por póliza" rows={issueRows} />
        {commissions ? (
          <ModuleCard
            title="Comisiones por aseguradora"
            sub={
              <form method="get" className="flex items-center gap-1.5">
                <select
                  name="mes"
                  defaultValue={month.value}
                  aria-label="Mes"
                  className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs"
                >
                  {recentMonths(12).map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <button type="submit" className="text-xs font-semibold text-link hover:underline">
                  Ver
                </button>
              </form>
            }
            rows={commissionRows}
          />
        ) : (
          <ModuleCard title="Comisiones por aseguradora" sub="Solo para quien ve las comisiones de todos" rows={[]} />
        )}
        <ModuleCard title="Siniestros" sub="Seguimiento por estado" rows={claimRows} />
      </div>

      <div className="flex flex-col gap-5">
        <Queue
          title="Emisiones en trámite"
          hint="Pólizas que la aseguradora todavía no emite (BASE EMISIONES). Las más antiguas primero."
          count={pendingIssues.length}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={th}>Póliza</th>
                <th className={th}>Cliente</th>
                <th className={th}>Aseguradora</th>
                <th className={th}>Estado</th>
                <th className={`${th} text-right`}>Días esperando</th>
              </tr>
            </thead>
            <tbody>
              {pendingIssues.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className={td}>
                    <PolicyLink id={p.id} number={p.policyNumber} />
                  </td>
                  <td className={td}>{clientDisplayName(p)}</td>
                  <td className={td}>{p.insurerName}</td>
                  <td className={td}>{p.issueStatus === "INSPECCION" ? "Esperando inspección" : "Pendiente"}</td>
                  <td className={`${td} text-right tabular-nums ${p.daysWaiting > 7 ? "font-semibold text-warn" : ""}`}>
                    {p.daysWaiting}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Queue>

        <Queue
          title="Cuotas por cobrar"
          hint={`Vencidas y las que vencen en los próximos ${DUE_SOON_DAYS} días (BASE PENDIENTE).${
            overdue.length ? ` Vencido: ${formatUSD(overdueCents)} en ${overdue.length} cuota${overdue.length === 1 ? "" : "s"}.` : ""
          }`}
          count={dueInstallments.length}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={th}>Póliza</th>
                <th className={th}>Cliente</th>
                <th className={th}>Aseguradora</th>
                <th className={th}>Cuota</th>
                <th className={th}>Vence</th>
                <th className={`${th} text-right`}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {dueInstallments.map((i) => (
                <tr key={i.id} className="border-b border-border last:border-0">
                  <td className={td}>
                    <PolicyLink id={i.policyId} number={i.policyNumber} />
                  </td>
                  <td className={td}>{clientDisplayName(i)}</td>
                  <td className={td}>{i.insurerName}</td>
                  <td className={`${td} tabular-nums`}>{i.installmentNumber}</td>
                  <td className={td}>
                    {i.dueDate}{" "}
                    {i.urgency === "VENCIDA" ? (
                      <span className="ml-1 rounded-full bg-bad-bg px-2 py-0.5 text-xs font-semibold text-bad">
                        vencida hace {-i.days} día{i.days === -1 ? "" : "s"}
                      </span>
                    ) : (
                      <span className="ml-1 text-xs text-muted">
                        {i.days === 0 ? "hoy" : `en ${i.days} día${i.days === 1 ? "" : "s"}`}
                      </span>
                    )}
                  </td>
                  <td className={`${td} text-right font-semibold tabular-nums`}>{formatUSD(i.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Queue>

        <Queue
          title="Cancelaciones por confirmar"
          hint="Pedidas a la aseguradora y todavía sin confirmar (ESTATUS PENDIENTE de BASE CANCELADAS)."
          count={pendingCancellations.length}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={th}>Póliza</th>
                <th className={th}>Cliente</th>
                <th className={th}>Aseguradora</th>
                <th className={th}>Pedida el</th>
                <th className={th}>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {pendingCancellations.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className={td}>
                    <PolicyLink id={p.id} number={p.policyNumber} />
                  </td>
                  <td className={td}>{clientDisplayName(p)}</td>
                  <td className={td}>{p.insurerName}</td>
                  <td className={td}>{p.cancelledAt ?? "—"}</td>
                  <td className={`${td} text-muted`}>{p.cancellationReason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Queue>

        {commissions && (
          <Queue
            title="Comisiones por resolver"
            hint="Pólizas vigentes sin % de comisión, y descuentos por cancelación que la aseguradora aún no aplica."
            count={commissions.toResolve.length}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className={th}>Póliza</th>
                  <th className={th}>Cliente</th>
                  <th className={th}>Aseguradora</th>
                  <th className={th}>Falta</th>
                  <th className={`${th} text-right`}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {commissions.toResolve.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className={td}>
                      <PolicyLink id={c.policyId} number={c.policyNumber} />
                    </td>
                    <td className={td}>{clientDisplayName(c)}</td>
                    <td className={td}>{c.insurerName}</td>
                    <td className={td}>
                      {c.discountStatus === "PENDIENTE" ? "Descuento por cancelación" : "Fijar % de comisión"}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      {c.discountStatus === "PENDIENTE"
                        ? formatUSD(c.discountAmountCents ?? 0)
                        : `${formatUSD(c.baseAmountCents)} base`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Queue>
        )}

        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Descargar como en el Excel</h2>
          <p className="mt-0.5 text-xs text-muted">
            Las hojas BASE con sus mismas columnas, en CSV que Excel abre directo. Incluye solo tus ramos.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {BACK_OFFICE_BASES.filter((b) => b !== "comisiones" || commissions).map((b) => (
              <a
                key={b}
                href={`/api/back-office/${b}`}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-background"
              >
                ⬇ {BASE_LABELS[b]}
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
