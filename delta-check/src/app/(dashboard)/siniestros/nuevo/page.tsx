import { notFound } from "next/navigation";
import { getPolicyDetail } from "@/actions/policy.actions";
import { listInsurersByBranch } from "@/actions/catalog.actions";
import { ReportClaimForm } from "@/components/policies/ReportClaimForm";

/**
 * Con `policyId` (link "Reportar siniestro" desde Cartera): marca,
 * aseguradora y cliente salen de la póliza. Sin `policyId` (link directo
 * desde Siniestros): no hay póliza que los traiga, se piden a mano — ver
 * la nota en claims (src/db/schema/policies.ts) sobre por qué el Excel
 * original tampoco lo exigía.
 */
export default async function NuevoSiniestroPage({
  searchParams,
}: {
  searchParams: Promise<{ policyId?: string }>;
}) {
  const { policyId } = await searchParams;

  if (policyId) {
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
          <ReportClaimForm linkedPolicy={{ id: policyId, branch: detail.policy.branch }} />
        </div>
      </main>
    );
  }

  const insurersByBranch = await listInsurersByBranch();

  return (
    <main className="mx-auto max-w-2xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Reportar siniestro</h1>
        <p className="mt-1 text-sm text-muted">
          Sin vincular a una póliza de Cartera — útil cuando el siniestro llega antes de tener la póliza cargada.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <ReportClaimForm insurersByBranch={insurersByBranch} />
      </div>
    </main>
  );
}
