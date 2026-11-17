import { notFound } from "next/navigation";
import { getHealthQuoteClientForEdit } from "@/actions/health-quote.actions";
import { EditHealthClientForm } from "@/components/quoting/EditHealthClientForm";

/** "Editar cliente" de una cotización de Salud — ver getHealthQuoteClientForEdit en health-quote.actions.ts. */
export default async function EditarClienteSaludPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const edit = await getHealthQuoteClientForEdit(quoteId);
  if (!edit) notFound();

  return (
    <main className="mx-auto max-w-xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Editar cliente — {edit.quoteCode}</h1>
        <p className="mt-1 text-sm text-muted">Corrige los datos del titular de esta cotización.</p>
      </header>
      <EditHealthClientForm quoteId={edit.quoteId} client={edit.client} titular={edit.titular} />
    </main>
  );
}
