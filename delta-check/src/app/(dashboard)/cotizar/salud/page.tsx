import Link from "next/link";
import { listMyHealthQuotes } from "@/actions/health-quote.actions";
import { MyQuotesTable } from "@/components/quoting/MyQuotesTable";
import { getAccess } from "@/domains/identity/services/rbac.service";

/**
 * "Mis cotizaciones — Salud" — mismo patrón exacto que la página
 * equivalente de Autos (cotizar/autos/page.tsx). El link "Salud AM" del
 * sidebar apunta acá (no directo al formulario) para que el agente pueda
 * ver y retomar sus cotizaciones existentes, no solo crear una nueva.
 */
export default async function MisCotizacionesSaludPage() {
  const [items, access] = await Promise.all([listMyHealthQuotes(), getAccess()]);
  const canDelete = access?.permissions.has("quote:delete") ?? false;

  return (
    <main className="mx-auto max-w-4xl p-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Mis cotizaciones — Salud</h1>
          <p className="mt-1 text-sm text-muted">Incluye borradores guardados sin terminar de comparar.</p>
        </div>
        <Link
          href="/cotizar/salud/nueva"
          className="shrink-0 rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white"
        >
          + Nueva cotización
        </Link>
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted">
          Todavía no tienes ninguna cotización de Salud.
        </div>
      ) : (
        <MyQuotesTable items={items} branch="salud" canDelete={canDelete} />
      )}
    </main>
  );
}
