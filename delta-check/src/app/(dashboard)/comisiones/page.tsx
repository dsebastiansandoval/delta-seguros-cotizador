import { listCommissions, listMyCommissions } from "@/actions/commission.actions";
import { formatUSD } from "@/domains/shared/money";
import { ForbiddenError } from "@/domains/identity/services/rbac.service";
import { SetCommissionForm, MarkCommissionPaidButton } from "@/components/policies/PolicyDetailActions";

/** SUPERVISOR/ADMIN ven todas; AGENTE solo las propias (commission:read_own) — mismo criterio que ARCHITECTURE.md §8.4. */
async function loadCommissions() {
  try {
    return { rows: await listCommissions(), all: true };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { rows: await listMyCommissions(), all: false };
    }
    throw err;
  }
}

export default async function ComisionesPage() {
  const { rows, all } = await loadCommissions();

  return (
    <main className="mx-auto max-w-5xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Comisiones</h1>
        <p className="mt-1 text-sm text-muted">
          {rows.length} registros {!all && "— solo las tuyas"}
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Póliza</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Aseguradora</th>
              <th className="px-4 py-3 text-right">Base</th>
              <th className="px-4 py-3 text-right">%</th>
              <th className="px-4 py-3 text-right">Comisión</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const clientName = c.clientBusinessName || `${c.clientFirstName ?? ""} ${c.clientLastName ?? ""}`.trim();
              return (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <a href={`/cartera/${c.policyId}`} className="text-link underline">
                      {c.policyNumber || "(sin número)"}
                    </a>
                  </td>
                  <td className="px-4 py-3">{clientName || "—"}</td>
                  <td className="px-4 py-3">{c.insurerName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatUSD(c.baseAmountCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.percent ? `${c.percent}%` : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c.amountCents != null ? formatUSD(c.amountCents) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={c.status === "COMISIONADA" ? "text-green-700" : "text-amber-700"}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {all && c.status === "PENDIENTE" && (
                      <div className="flex items-center gap-2">
                        <SetCommissionForm commissionId={c.id} />
                        {c.percent && <MarkCommissionPaidButton commissionId={c.id} />}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  Sin comisiones todavía — se crean automáticamente al emitir una póliza.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
