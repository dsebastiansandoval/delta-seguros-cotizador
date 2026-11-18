import Link from "next/link";
import { notFound } from "next/navigation";
import { getHealthQuoteComparison } from "@/actions/health-quote.actions";
import { HealthOfferConfigurationForm } from "@/components/quoting/HealthOfferConfigurationForm";

export default async function ConfigurarOfertaSaludPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const data = await getHealthQuoteComparison(quoteId);
  if (!data) notFound();

  // Mismo criterio que cotizar/autos/[quoteId]/configurar: "ya hay
  // comparativa" = al menos un plan incluido con prima digitada, no solo
  // que existan filas (se crean vacías desde el inicio). Antes este link
  // salía siempre, aunque nada se hubiera guardado todavía — llevaba a una
  // comparativa vacía/vieja en vez de guardar lo que se acababa de marcar
  // abajo (eso sí lo hace el botón "Ver comparativa →" del formulario).
  const hasComparativa = data.rows.some((r) => r.includedInOffer && r.totalPremiumCents != null);

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
        <div className="flex shrink-0 gap-4">
          <Link href={`/cotizar/salud/${quoteId}/editar`} className="text-sm font-semibold text-link underline">
            Editar cotización
          </Link>
          {hasComparativa && (
            <Link href={`/cotizar/salud/${quoteId}/comparar`} className="text-sm font-semibold text-link underline">
              Ver comparativa
            </Link>
          )}
        </div>
      </header>
      <HealthOfferConfigurationForm quoteId={quoteId} rows={data.rows} />
    </main>
  );
}
