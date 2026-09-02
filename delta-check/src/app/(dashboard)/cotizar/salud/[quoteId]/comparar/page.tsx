import { notFound } from "next/navigation";
import { getHealthQuoteComparison } from "@/actions/health-quote.actions";
import { formatUSD } from "@/domains/shared/money";
import { HealthManualPremiumForm } from "@/components/quoting/HealthManualPremiumForm";

export default async function CompararSaludPage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  const data = await getHealthQuoteComparison(quoteId);
  if (!data) notFound();

  const { quote, rows } = data;
  const best = rows.find((r) => r.status === "COTIZADO");

  return (
    <main className="mx-auto max-w-4xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Comparativa Salud — {quote.code}</h1>
        <p className="mt-1 text-sm text-muted">
          {rows.length} opciones · {rows.filter((r) => r.status === "COTIZADO").length} con prima
          calculada, {rows.filter((r) => r.status === "PENDIENTE_MANUAL").length} pendientes de
          digitar
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Aseguradora</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Prima total (grupo)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.quoteOptionId} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{row.insurerName}</td>
                <td className="px-4 py-3 text-muted">{row.planCode ?? "—"}</td>
                <td className="px-4 py-3">
                  {row.status === "COTIZADO" ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                      Cotizado
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      Pendiente — digitar
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {row.totalPremiumCents != null ? (
                    <span className={row.quoteOptionId === best?.quoteOptionId ? "text-delta-blue" : ""}>
                      {formatUSD(row.totalPremiumCents)}
                      {row.quoteOptionId === best?.quoteOptionId && " ★"}
                    </span>
                  ) : (
                    <HealthManualPremiumForm quoteOptionId={row.quoteOptionId} quoteId={quoteId} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
