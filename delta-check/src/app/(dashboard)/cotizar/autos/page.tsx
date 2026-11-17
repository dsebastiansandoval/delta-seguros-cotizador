import Link from "next/link";
import { listMyAutoQuotes } from "@/actions/quote.actions";
import { MyQuotesTable } from "@/components/quoting/MyQuotesTable";
import { getAccess } from "@/domains/identity/services/rbac.service";

/**
 * "Mis cotizaciones" — sin esto, "Guardar borrador" era un callejón sin
 * salida (se guardaba la cotización, pero no había forma de volver a
 * encontrarla salvo acordarse la URL exacta). Con `quote:read_all`
 * (ADMIN/SUPERVISOR) pasa a ser "Cotizaciones" a secas — ve la de toda
 * la organización, no solo la propia — ver listMyAutoQuotes().
 */
export default async function MisCotizacionesAutosPage() {
  const [items, access] = await Promise.all([listMyAutoQuotes(), getAccess()]);
  const canDelete = access?.permissions.has("quote:delete") ?? false;
  const seeAll = access?.permissions.has("quote:read_all") ?? false;

  return (
    <main className="mx-auto max-w-5xl p-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{seeAll ? "Cotizaciones — Autos" : "Mis cotizaciones — Autos"}</h1>
          <p className="mt-1 text-sm text-muted">Incluye borradores guardados sin terminar de comparar.</p>
        </div>
        <Link
          href="/cotizar/autos/nueva"
          className="shrink-0 rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white"
        >
          + Nueva cotización
        </Link>
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted">
          Todavía no hay ninguna cotización de Autos.
        </div>
      ) : (
        <MyQuotesTable items={items} branch="autos" canDelete={canDelete} showAgent={seeAll} />
      )}
    </main>
  );
}
