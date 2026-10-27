import { notFound } from "next/navigation";
import { getClaimDetail } from "@/actions/claim.actions";
import { AddClaimNoteForm } from "@/components/policies/AddClaimNoteForm";
import { ClaimStatusForm } from "@/components/policies/ClaimStatusForm";
import { formatUSD } from "@/domains/shared/money";

const STATUS_LABEL: Record<string, string> = {
  REPORTADO: "Reportado",
  APROBADO: "Aprobado",
  REPARADO: "Reparado",
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

/** Una fila del historial — nota escrita a mano o el registro automático de un cambio de estado. */
function EventRow({ event }: { event: { eventType: string; note: string | null; fromStatus: string | null; toStatus: string | null; createdAt: Date; userFullName: string | null } }) {
  const who = event.userFullName ?? "Sistema";
  const when = formatDateTime(event.createdAt);

  if (event.eventType === "STATUS_CHANGE") {
    return (
      <li className="flex items-center gap-2 py-2 text-xs text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-delta-navy" />
        <span>
          {who} cambió el estado de <strong>{STATUS_LABEL[event.fromStatus ?? ""] ?? event.fromStatus}</strong> a{" "}
          <strong>{STATUS_LABEL[event.toStatus ?? ""] ?? event.toStatus}</strong> · {when}
        </span>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-border bg-surface px-3 py-2">
      <p className="text-sm">{event.note}</p>
      <p className="mt-1 text-xs text-muted">
        {who} · {when}
      </p>
    </li>
  );
}

export default async function ClaimDetailPage({ params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params;
  const detail = await getClaimDetail(claimId);
  if (!detail) notFound();

  const { claim, policyNumber, insurerName, standaloneInsurerName, clientFirstName, clientLastName, clientBusinessName, events } =
    detail;
  const clientName = clientBusinessName || `${clientFirstName ?? ""} ${clientLastName ?? ""}`.trim() || claim.clientName;
  const effectiveInsurerName = insurerName ?? standaloneInsurerName;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">
          Siniestro {claim.claimNumber || `— ${clientName || "sin cliente"}`}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {effectiveInsurerName} · {clientName || "—"}
          {claim.policyId ? (
            <>
              {" · "}
              <a href={`/cartera/${claim.policyId}`} className="text-link underline">
                {policyNumber || "(sin número)"}
              </a>
            </>
          ) : (
            <>
              {" · "}
              {policyNumber || "(sin número de póliza)"}
              {claim.clientDocumentNumber && <> · {claim.clientDocumentNumber}</>}
              <span className="ml-1 text-xs" title="Reportado sin vincular a una póliza de Cartera">
                (sin póliza en Cartera)
              </span>
            </>
          )}
        </p>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-4 rounded-xl border border-border bg-surface p-5 text-sm shadow-sm sm:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Estado</p>
          <div className="mt-1"><ClaimStatusForm claimId={claim.id} status={claim.status} /></div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Ocurrido</p>
          <p className="mt-1">{claim.occurredAt || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Reportado</p>
          <p className="mt-1">{claim.reportedAt || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Valor</p>
          <p className="mt-1">{claim.claimValueCents != null ? formatUSD(claim.claimValueCents) : "—"}</p>
        </div>
        {claim.workshop && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Taller</p>
            <p className="mt-1">{claim.workshop}</p>
          </div>
        )}
        {claim.advisorName && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Asesor</p>
            <p className="mt-1">{claim.advisorName}</p>
          </div>
        )}
        {claim.contactPhone && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Contacto</p>
            <p className="mt-1">{claim.contactPhone}</p>
          </div>
        )}
        {claim.hasThirdPartyLiability && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">RC — placa tercero</p>
            <p className="mt-1">{claim.thirdPartyPlate || "—"}</p>
          </div>
        )}
        {claim.description && (
          <div className="col-span-full">
            <p className="text-xs uppercase tracking-wide text-muted">Descripción</p>
            <p className="mt-1">{claim.description}</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Historial de novedades — {events.length} {events.length === 1 ? "registro" : "registros"}
        </h2>
        <ul className="mb-4 flex flex-col gap-2">
          {events.length === 0 && <li className="text-sm text-muted">Sin novedades todavía.</li>}
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </ul>
        <AddClaimNoteForm claimId={claim.id} />
      </section>
    </main>
  );
}
