import { notFound } from "next/navigation";
import { getQuoteComparison } from "@/actions/quote.actions";
import { AutosComparisonView } from "@/components/quoting/AutosComparisonView";

export default async function CompararPage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  const data = await getQuoteComparison(quoteId);
  if (!data) notFound();

  const { quote, rows } = data;
  const isKm = rows[0]?.modality === "POR_KM";

  return (
    <main className="mx-auto max-w-5xl p-8">
      <AutosComparisonView quoteId={quoteId} quoteCode={quote.code} rows={rows} isKm={isKm} />
    </main>
  );
}
