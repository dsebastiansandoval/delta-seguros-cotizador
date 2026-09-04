import { notFound } from "next/navigation";
import { getQuoteOptionSummary } from "@/actions/policy.actions";
import { formatUSD } from "@/domains/shared/money";
import { EmitPolicyForm } from "@/components/policies/EmitPolicyForm";

export default async function EmitirPolizaPage({
  searchParams,
}: {
  searchParams: Promise<{ quoteOptionId?: string }>;
}) {
  const { quoteOptionId } = await searchParams;
  if (!quoteOptionId) notFound();

  const summary = await getQuoteOptionSummary(quoteOptionId);
  if (!summary || summary.totalPremiumCents == null) notFound();

  const clientName = summary.clientBusinessName || `${summary.clientFirstName ?? ""} ${summary.clientLastName ?? ""}`.trim();

  return (
    <main className="mx-auto max-w-2xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Emitir póliza</h1>
        <p className="mt-1 text-sm text-muted">
          {summary.insurerName} {summary.planCode && `— ${summary.planCode}`} · {clientName} ·{" "}
          <span className="font-semibold text-delta-blue">{formatUSD(summary.totalPremiumCents)}</span>
        </p>
      </header>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <EmitPolicyForm quoteOptionId={quoteOptionId} />
      </div>
    </main>
  );
}
