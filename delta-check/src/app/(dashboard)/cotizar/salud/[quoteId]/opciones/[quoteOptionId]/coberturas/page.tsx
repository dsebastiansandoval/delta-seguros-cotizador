import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuoteOptionCoverages } from "@/actions/quote-coverage.actions";
import { CoverageForm } from "@/components/quoting/CoverageForm";
import { HealthPlanCoverageTable } from "@/components/quoting/HealthPlanCoverageTable";

export default async function CoberturasPage({
  params,
}: {
  params: Promise<{ quoteId: string; quoteOptionId: string }>;
}) {
  const { quoteId, quoteOptionId } = await params;
  const data = await getQuoteOptionCoverages(quoteOptionId);
  if (!data) notFound();

  const { context } = data;
  const branchPath = context.branch === "SALUD" ? "salud" : "autos";

  return (
    <main className="mx-auto max-w-2xl p-8">
      <header className="mb-6">
        <Link href={`/cotizar/${branchPath}/${quoteId}/comparar`} className="text-xs font-semibold text-link underline">
          ← Volver a la comparativa
        </Link>
        <h1 className="mt-2 text-xl font-bold tracking-tight">
          Detalles del plan — {context.insurerName}
        </h1>
        {data.mode === "CATALOG" ? (
          <p className="mt-1 text-sm text-muted">
            {context.quoteCode} · {context.planCode ?? "—"}. Copago, sublímites y carencias del catálogo de esta
            aseguradora/plan — de solo lectura (se edita en el catálogo, no por cotización).
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">
            {context.quoteCode} · {context.planCode ?? "—"}. Ingresá los detalles del plan (copago, sublímites,
            carencias) según confirmación de la aseguradora — dejá vacío lo que todavía no te confirmaron.
          </p>
        )}
      </header>

      {data.mode === "CATALOG" ? (
        <HealthPlanCoverageTable rows={data.planCoverages} />
      ) : (
        <CoverageForm quoteOptionId={quoteOptionId} coverages={data.coverages} />
      )}
    </main>
  );
}
