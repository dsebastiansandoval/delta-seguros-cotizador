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

  const { quote, riskGroups } = data;

  return (
    <main className="mx-auto max-w-5xl p-8">
      <AutosComparisonView quoteId={quoteId} quoteCode={quote.code} riskGroups={riskGroups} />
    </main>
  );
}
