import Link from "next/link";
import { listArcoRequests } from "@/actions/arco.actions";

const TYPE_LABEL: Record<string, string> = {
  ACCESO: "Acceso",
  RECTIFICACION: "Rectificación",
  CANCELACION: "Cancelación",
  OPOSICION: "Oposición",
};

const STATUS_STYLE: Record<string, string> = {
  RECIBIDA: "bg-amber-100 text-amber-800",
  EN_PROCESO: "bg-blue-100 text-blue-800",
  COMPLETADA: "bg-green-100 text-green-800",
  RECHAZADA: "bg-red-100 text-red-800",
};

export default async function CumplimientoPage() {
  const requests = await listArcoRequests();

  return (
    <main className="mx-auto max-w-5xl p-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Cumplimiento — Derechos ARCO</h1>
          <p className="mt-1 text-sm text-muted">{requests.length} solicitudes</p>
        </div>
        <Link
          href="/cumplimiento/nueva"
          className="shrink-0 rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white"
        >
          Nueva solicitud
        </Link>
      </header>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Titular</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Solicitada</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const clientName = r.clientBusinessName || `${r.clientFirstName ?? ""} ${r.clientLastName ?? ""}`.trim();
              return (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-background">
                  <td className="px-4 py-3">
                    <Link href={`/cumplimiento/${r.id}`} className="font-medium text-link underline">
                      {clientName || r.clientDocumentNumber} ({r.clientDocumentNumber})
                    </Link>
                  </td>
                  <td className="px-4 py-3">{TYPE_LABEL[r.type]}</td>
                  <td className="px-4 py-3 text-muted">{new Date(r.requestedAt).toLocaleDateString("es-EC")}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {requests.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  Sin solicitudes ARCO todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
