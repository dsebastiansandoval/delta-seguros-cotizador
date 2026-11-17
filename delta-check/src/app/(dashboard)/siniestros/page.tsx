import Link from "next/link";
import { listClaims } from "@/actions/claim.actions";
import { ClaimsTable } from "@/components/policies/ClaimsTable";

export default async function SiniestrosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const isSearching = Boolean(q?.trim());
  const claims = await listClaims(q);

  return (
    <main className="mx-auto max-w-7xl p-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Siniestros</h1>
          <p className="mt-1 text-sm text-muted">
            {claims.length} {isSearching ? "resultados (incluye entregados)" : "siniestros vigentes"}
          </p>
        </div>
        <Link
          href="/siniestros/nuevo"
          className="rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white"
        >
          + Reportar siniestro
        </Link>
      </header>

      <form action="/siniestros" className="mb-4 flex items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por cédula, nombre y apellido, o N° de póliza — incluye entregados"
          className="w-96 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">
          Buscar
        </button>
        {isSearching && (
          <Link href="/siniestros" className="text-sm font-semibold text-link underline">
            Ver vigentes
          </Link>
        )}
      </form>

      <ClaimsTable claims={claims} />
    </main>
  );
}
