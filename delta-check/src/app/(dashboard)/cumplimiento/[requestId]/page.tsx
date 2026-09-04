import { notFound } from "next/navigation";
import { getArcoRequestDetail } from "@/actions/arco.actions";
import {
  AnonymizeClientForm,
  ExportClientDataButton,
  MarketingOptOutForm,
  RectifyClientForm,
  UpdateArcoStatusForm,
} from "@/components/compliance/ArcoDetailActions";

export default async function ArcoRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const detail = await getArcoRequestDetail(requestId);
  if (!detail) notFound();

  const { request, client } = detail;
  const clientName = client.businessName || `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Solicitud ARCO — {request.type}</h1>
        <p className="mt-1 text-sm text-muted">
          {clientName || "(sin nombre)"} · {client.documentNumber}
          {client.isAnonymized && <span className="ml-2 text-red-700">— datos anonimizados</span>}
        </p>
      </header>

      <section className="mb-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Estado</h2>
        <p className="mb-3 text-sm">
          {request.status} · solicitada el {new Date(request.requestedAt).toLocaleDateString("es-EC")}
          {request.channel && ` · canal: ${request.channel}`}
        </p>
        {request.notes && <p className="mb-3 text-sm text-muted">Notas: {request.notes}</p>}
        {request.resolutionNotes && (
          <p className="mb-3 text-sm text-green-700">Resolución: {request.resolutionNotes}</p>
        )}
        <UpdateArcoStatusForm requestId={request.id} status={request.status} />
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          Procesar — {request.type}
        </h2>

        {request.type === "ACCESO" && <ExportClientDataButton clientId={client.id} />}

        {request.type === "RECTIFICACION" && (
          <RectifyClientForm
            requestId={request.id}
            clientId={client.id}
            current={{
              firstName: client.firstName,
              lastName: client.lastName,
              businessName: client.businessName,
              email: client.email,
              phone: client.phone,
            }}
          />
        )}

        {request.type === "CANCELACION" && (
          <AnonymizeClientForm requestId={request.id} clientId={client.id} />
        )}

        {request.type === "OPOSICION" && (
          <MarketingOptOutForm requestId={request.id} clientId={client.id} current={client.marketingOptOut} />
        )}
      </section>
    </main>
  );
}
