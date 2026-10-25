import Link from "next/link";
import { notFound } from "next/navigation";
import { getOfferSheet } from "@/actions/offer.actions";
import { OfferSheetView } from "@/components/quoting/OfferSheetView";
import { GenerateComparisonButton } from "@/components/quoting/GenerateComparisonButton";

export default async function CompararPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const sheet = await getOfferSheet(quoteId);
  if (!sheet) notFound();

  const { generated } = sheet;
  const hasPremium =
    sheet.kind === "KM"
      ? Boolean(sheet.km?.brackets.some((b) => b.totals))
      : sheet.columns.some((c) => c.totals);

  return (
    <main className="mx-auto max-w-[1400px] p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Comparativa — {sheet.quote.code}
            {sheet.kind === "KM" && <span className="text-muted"> (Auto x Km)</span>}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {sheet.risks.length > 1 ? `${sheet.risks.length} riesgos en esta cotización` : "1 riesgo en esta cotización"}
          </p>
        </div>
        {generated && (
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href={`/cotizar/autos/${quoteId}/configurar`}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
            >
              Configurar oferta
            </Link>
            {hasPremium && (
              <a
                href={`/api/quotes/${quoteId}/caratula`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white"
              >
                Descargar oferta PDF
              </a>
            )}
          </div>
        )}
      </header>

      {generated ? (
        <OfferSheetView sheet={sheet} />
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted">
          Todavía no se generó la comparativa para esta cotización.
          <GenerateComparisonButton quoteId={quoteId} />
        </div>
      )}
    </main>
  );
}

