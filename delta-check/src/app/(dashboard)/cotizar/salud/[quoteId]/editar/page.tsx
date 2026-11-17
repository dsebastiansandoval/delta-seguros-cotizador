import { notFound } from "next/navigation";
import { listQuoteVendors } from "@/actions/catalog.actions";
import { getHealthQuoteForEdit } from "@/actions/health-quote.actions";
import { getAccess, vendorMode } from "@/domains/identity/services/rbac.service";
import { EditHealthQuoteForm } from "@/components/quoting/EditHealthQuoteForm";

/** "Editar" de una cotización de Salud, sin importar el estado — ver getHealthQuoteForEdit en health-quote.actions.ts. */
export default async function EditarCotizacionSaludPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const [session, edit, vendors] = await Promise.all([getAccess(), getHealthQuoteForEdit(quoteId), listQuoteVendors("SALUD")]);
  if (!edit) notFound();

  const currentVendor = edit.client.vendor ?? session?.fullName ?? "";
  const mode = session ? vendorMode(session) : "locked";

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Editar cotización — {edit.quoteCode}</h1>
        <p className="mt-1 text-sm text-muted">Corrige el cliente, el titular, la región o los dependientes.</p>
      </header>
      <EditHealthQuoteForm
        quoteId={edit.quoteId}
        vendors={vendors}
        currentVendor={currentVendor}
        vendorMode={mode}
        client={edit.client}
        titular={edit.titular}
        region={edit.region}
        dependents={edit.dependents}
      />
    </main>
  );
}
