import { notFound } from "next/navigation";
import { getPolicyDetail } from "@/actions/policy.actions";
import { ReportClaimForm } from "@/components/policies/ReportClaimForm";

export default async function NuevoSiniestroPage({
  searchParams,
}: {
  searchParams: Promise<{ policyId?: string }>;
}) {
  const { policyId } = await searchParams;
  if (!policyId) notFound();

  const detail = await getPolicyDetail(policyId);
  if (!detail) notFound();

  const clientName =
    detail.clientBusinessName || `${detail.clientFirstName ?? ""} ${detail.clientLastName ?? ""}`.trim();

  return (
    <main className="mx-auto max-w-2xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Reportar siniestro</h1>
        <p className="mt-1 text-sm text-muted">
          Póliza {detail.policy.policyNumber || "(sin número)"} · {detail.insurerName} · {clientName}
        </p>
      </header>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <ReportClaimForm policyId={policyId} />
      </div>
    </main>
  );
}
