import Link from "next/link";
import { listMyAutoQuotes } from "@/actions/quote.actions";

const STATUS_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  ENVIADA: "Enviada",
  ACEPTADA: "Aceptada",
  VENCIDA: "Vencida",
};

const STATUS_STYLE: Record<string, string> = {
  BORRADOR: "bg-warn-bg text-warn",
  ENVIADA: "bg-accent-100 text-highlight",
  ACEPTADA: "bg-good-bg text-good",
  VENCIDA: "bg-bad-bg text-bad",
};

/**
 * "Mis cotizaciones" — sin esto, "Guardar borrador" era un callejón sin
 * salida (se guardaba la cotización, pero no había forma de volver a
 * encontrarla salvo acordarse la URL exacta). Lista de trabajo personal
 * del agente, no un reporte gerencial — ver listMyAutoQuotes().
 */
export default async function MisCotizacionesAutosPage() {
  const items = await listMyAutoQuotes();

  return (
    <main className="mx-auto max-w-4xl p-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Mis cotizaciones — Autos</h1>
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
          Todavía no tienes ninguna cotización de Autos.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Creada</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((q) => (
                <tr key={q.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{q.code}</td>
                  <td className="px-4 py-3 text-muted">{q.operationType === "RENOVACION" ? "Renovación" : "Nueva"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[q.status]}`}>
                      {STATUS_LABEL[q.status] ?? q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{new Date(q.createdAt).toLocaleDateString("es-EC")}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/cotizar/autos/${q.id}/comparar`} className="text-xs font-semibold text-link underline">
                      {q.status === "BORRADOR" ? "Continuar" : "Ver"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
