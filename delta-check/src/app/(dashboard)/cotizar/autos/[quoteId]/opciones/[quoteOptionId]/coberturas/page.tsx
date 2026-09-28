import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuoteOptionCoverages } from "@/actions/quote-coverage.actions";
import { CoverageForm } from "@/components/quoting/CoverageForm";

export default async function CoberturasPage({
  params,
}: {
  params: Promise<{ quoteId: string; quoteOptionId: string }>;
}) {
  const { quoteId, quoteOptionId } = await params;
  const data = await getQuoteOptionCoverages(quoteOptionId);
  if (!data) notFound();

  const { context, coverages } = data;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <header className="mb-6">
        <Link href={`/cotizar/autos/${quoteId}/comparar`} className="text-xs font-semibold text-link underline">
          ← Volver a la comparativa
        </Link>
        <h1 className="mt-2 text-xl font-bold tracking-tight">
          Coberturas — {context.insurerName}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {context.quoteCode} · {context.vehicleLabel}. Lo que guardes acá aparece como un detalle adicional
          en la carátula PDF de esta aseguradora — dejá vacío lo que todavía no te confirmaron.
        </p>
      </header>

      <CoverageForm quoteOptionId={quoteOptionId} coverages={coverages} />
    </main>
  );
}
