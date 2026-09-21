import Link from "next/link";
import { listPolicies } from "@/actions/policy.actions";
import { formatUSD } from "@/domains/shared/money";

const ISSUE_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EMITIDA: "Emitida",
  NO_EMITIDA: "No emitida",
};
const PAYMENT_LABEL: Record<string, string> = { PENDIENTE: "Pendiente", PAGADO: "Pagado" };

export default async function CarteraPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const lifecycleStatus = estado === "canceladas" ? "CANCELADA" : estado === "vigentes" ? "VIGENTE" : undefined;
  const policies = await listPolicies(lifecycleStatus ? { lifecycleStatus } : undefined);

  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Cartera</h1>
        <p className="mt-1 text-sm text-muted">{policies.length} pólizas</p>
        <nav className="mt-3 flex gap-4 text-sm">
          <Link href="/cartera" className={!estado ? "font-semibold text-link" : "text-muted"}>
            Todas
          </Link>
          <Link href="/cartera?estado=vigentes" className={estado === "vigentes" ? "font-semibold text-link" : "text-muted"}>
            Vigentes
          </Link>
          <Link href="/cartera?estado=canceladas" className={estado === "canceladas" ? "font-semibold text-link" : "text-muted"}>
            Canceladas
          </Link>
        </nav>
      </header>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Póliza</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Aseguradora</th>
              <th className="px-4 py-3">Ramo</th>
              <th className="px-4 py-3">Emisión</th>
              <th className="px-4 py-3">Pago</th>
              <th className="px-4 py-3">Vigencia</th>
              <th className="px-4 py-3 text-right">Prima</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => {
              const clientName = p.clientBusinessName || `${p.clientFirstName ?? ""} ${p.clientLastName ?? ""}`.trim();
              return (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-background">
                  <td className="px-4 py-3">
                    <a href={`/cartera/${p.id}`} className="font-medium text-link underline">
                      {p.policyNumber || "(sin número)"}
                    </a>
                  </td>
                  <td className="px-4 py-3">{clientName || "—"}</td>
                  <td className="px-4 py-3">{p.insurerName}</td>
                  <td className="px-4 py-3 text-muted">{p.branch}</td>
                  <td className="px-4 py-3">{ISSUE_LABEL[p.issueStatus]}</td>
                  <td className="px-4 py-3">{PAYMENT_LABEL[p.paymentStatus]}</td>
                  <td className="px-4 py-3">
                    {p.lifecycleStatus === "CANCELADA" ? (
                      <span className="rounded-full bg-bad-bg px-2 py-0.5 text-xs font-semibold text-bad">
                        Cancelada
                      </span>
                    ) : (
                      <span className="rounded-full bg-good-bg px-2 py-0.5 text-xs font-semibold text-good">
                        Vigente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {p.premiumCents != null ? formatUSD(p.premiumCents) : "—"}
                  </td>
                </tr>
              );
            })}
            {policies.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  Sin pólizas todavía — emití una desde el comparador de una cotización.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
