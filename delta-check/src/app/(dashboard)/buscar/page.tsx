import Link from "next/link";
import { searchClientsAndVehicles } from "@/actions/search.actions";

const QUOTE_STATUS_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  ENVIADA: "Enviada",
  ACEPTADA: "Aceptada",
  VENCIDA: "Vencida",
};

const LIFECYCLE_LABEL: Record<string, string> = { VIGENTE: "Vigente", CANCELADA: "Cancelada" };

function quoteHref(quote: { id: string; branch: "AUTOS" | "SALUD" }) {
  return quote.branch === "AUTOS" ? `/cotizar/autos/${quote.id}/comparar` : `/cotizar/salud/${quote.id}/comparar`;
}

/**
 * Resultado del buscador del topbar (🔍 "Buscar cliente o placa…", ítem 5
 * del feedback del usuario). No existe (ni se pidió) una pantalla de
 * "perfil de cliente" propia — el resultado son links directos a lo que sí
 * existe: las cotizaciones y pólizas de cada cliente que coincide.
 */
export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const results = query ? await searchClientsAndVehicles(query) : [];

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Buscar</h1>
        <p className="mt-1 text-sm text-muted">
          {query ? (
            <>
              {results.length} resultado{results.length === 1 ? "" : "s"} para &quot;{query}&quot;
            </>
          ) : (
            "Escribe un nombre, documento o placa en el buscador de arriba."
          )}
        </p>
      </header>

      {query && results.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted">
          Sin coincidencias — probá con el documento completo o la placa exacta.
        </div>
      )}

      <div className="flex flex-col gap-4">
        {results.map((r) => (
          <div key={r.clientId} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-semibold">{r.displayName}</p>
              <p className="text-xs text-muted">{r.documentNumber}</p>
            </div>
            {r.matchedPlate && <p className="mt-1 text-xs text-muted">Placa: {r.matchedPlate}</p>}

            {r.policies.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {r.policies.map((p) => (
                  <Link
                    key={p.id}
                    href={`/cartera/${p.id}`}
                    className="rounded-full bg-accent-100 px-2.5 py-1 text-xs font-semibold text-highlight"
                  >
                    Póliza {p.policyNumber ?? "s/n"} · {LIFECYCLE_LABEL[p.lifecycleStatus] ?? p.lifecycleStatus}
                  </Link>
                ))}
              </div>
            )}

            {r.quotes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {r.quotes.map((qte) => (
                  <Link
                    key={qte.id}
                    href={quoteHref(qte)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-link"
                  >
                    {qte.code} · {qte.branch === "AUTOS" ? "Autos" : "Salud"} ·{" "}
                    {QUOTE_STATUS_LABEL[qte.status] ?? qte.status}
                  </Link>
                ))}
              </div>
            )}

            {r.policies.length === 0 && r.quotes.length === 0 && (
              <p className="mt-2 text-xs text-muted">Sin cotizaciones ni pólizas todavía.</p>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
