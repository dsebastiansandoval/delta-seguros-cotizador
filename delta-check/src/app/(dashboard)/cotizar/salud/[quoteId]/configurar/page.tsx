import Link from "next/link";
import { notFound } from "next/navigation";
import { getHealthQuoteComparison } from "@/actions/health-quote.actions";
import { HealthOfferConfigurationForm } from "@/components/quoting/HealthOfferConfigurationForm";

export default async function ConfigurarOfertaSaludPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const data = await getHealthQuoteComparison(quoteId);
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Configurar oferta Salud — {data.quote.code}</h1>
          <p className="mt-1 text-sm text-muted">
            Marca los planes que salen en la oferta (como &quot;Mostrar&quot; en OFERTA AM). Si una aseguradora no
            tiene tabla (BUPA), digita la prima neta del grupo; los cargos se suman solos.
          </p>
        </div>
        <Link href={`/cotizar/salud/${quoteId}/comparar`} className="shrink-0 text-sm font-semibold text-link underline">
          Ver comparativa
        </Link>
      </header>
      <HealthOfferConfigurationForm quoteId={quoteId} rows={data.rows} />
    </main>
  );
}
