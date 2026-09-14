import { listClaims } from "@/actions/claim.actions";
import { formatUSD } from "@/domains/shared/money";
import { ClaimStatusForm } from "@/components/policies/ClaimStatusForm";

export default async function SiniestrosPage() {
  const claims = await listClaims();

  return (
    <main className="mx-auto max-w-5xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Siniestros</h1>
        <p className="mt-1 text-sm text-muted">{claims.length} siniestros reportados</p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Póliza</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Aseguradora</th>
              <th className="px-4 py-3">Ocurrido</th>
              <th className="px-4 py-3">Reportado</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => {
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
                  <td className="px-4 py-3">{c.occurredAt || "—"}</td>
                  <td className="px-4 py-3">{c.reportedAt || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c.claimValueCents != null ? formatUSD(c.claimValueCents) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ClaimStatusForm claimId={c.id} status={c.status} />
                  </td>
                </tr>
              );
            })}
            {claims.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  Sin siniestros — se reportan desde el detalle de una póliza.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
