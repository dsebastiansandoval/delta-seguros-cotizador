import Link from "next/link";
import { notFound } from "next/navigation";
import { getOfferConfiguration } from "@/actions/offer.actions";
import { OfferConfigurationForm } from "@/components/quoting/OfferConfigurationForm";

export default async function ConfigurarOfertaPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const config = await getOfferConfiguration(quoteId);
  if (!config) notFound();

  return (
    <main className="mx-auto max-w-[1400px] p-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Configurar oferta — {config.quote.code}
            {config.quote.modality === "POR_KM" && <span className="text-muted"> (Auto x Km)</span>}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {config.quote.modality === "POR_KM"
              ? "Elige RC y deducible, y digita la prima total del portal para cada rango."
              : "Elige qué aseguradoras salen en la oferta, sus coberturas y deducibles, y digita la prima neta de cada portal. Latina y Cóndor se calculan solas."}
          </p>
        </div>
        <div className="flex shrink-0 gap-4">
          {config.quote.status === "BORRADOR" && (
            <Link href={`/cotizar/autos/${quoteId}/editar`} className="text-sm font-semibold text-link underline">
              Editar datos
            </Link>
          )}
          <Link href={`/cotizar/autos/${quoteId}/comparar`} className="text-sm font-semibold text-link underline">
            Ver comparativa
          </Link>
        </div>
      </header>
      {config.columns.length === 0 ? (
        <p className="text-sm text-muted">Esta cotización todavía no tiene comparativa generada.</p>
      ) : (
        <OfferConfigurationForm config={config} />
      )}
    </main>
  );
}
