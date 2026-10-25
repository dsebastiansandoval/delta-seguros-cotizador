import { notFound } from "next/navigation";
import { getPolicyDetail } from "@/actions/policy.actions";
import { formatUSD, centsToDollars } from "@/domains/shared/money";
import {
  CancelPolicyForm,
  ConfirmCancellationButton,
  GenerateInstallmentsForm,
  IssueStatusForm,
  MarkCommissionDiscountedButton,
  MarkCommissionPaidButton,
  MarkInstallmentPaidButton,
  MarkPolicyPaidButton,
  SetCommissionForm,
  SetPolicyNumberForm,
} from "@/components/policies/PolicyDetailActions";

const ISSUE_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  INSPECCION: "Inspección",
  EMITIDA: "Emitida",
  NO_EMITIDA: "No emitida",
};

export default async function PolicyDetailPage({
  params,
}: {
  params: Promise<{ policyId: string }>;
}) {
  const { policyId } = await params;
  const detail = await getPolicyDetail(policyId);
  if (!detail) notFound();

  const { policy, insurerName, clientFirstName, clientLastName, clientBusinessName, clientDocumentNumber, commission, installments } = detail;
  const clientName = clientBusinessName || `${clientFirstName ?? ""} ${clientLastName ?? ""}`.trim();
  const isCancelled = policy.lifecycleStatus !== "VIGENTE";

  return (
    <main className="mx-auto max-w-4xl p-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Póliza {policy.policyNumber || "(sin número)"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {insurerName} · {clientName} ({clientDocumentNumber}) · {policy.branch}
          </p>
        </div>
        {policy.lifecycleStatus === "CANCELADA" ? (
          <span className="rounded-full bg-bad-bg px-3 py-1 text-xs font-semibold text-bad">
            Cancelada — {policy.cancellationReason}
          </span>
        ) : policy.lifecycleStatus === "CANCELACION_PENDIENTE" ? (
          <span className="rounded-full bg-warn-bg px-3 py-1 text-xs font-semibold text-warn">
            Cancelación pendiente — {policy.cancellationReason}
          </span>
        ) : (
          <span className="rounded-full bg-good-bg px-3 py-1 text-xs font-semibold text-good">
            Vigente
          </span>
        )}
      </header>

      <section className="mb-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Datos generales</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">Prima total</dt>
            <dd className="font-semibold tabular-nums">{policy.premiumCents != null ? formatUSD(policy.premiumCents) : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Emisión</dt>
            <dd>{ISSUE_LABEL[policy.issueStatus]}</dd>
          </div>
          <div>
            <dt className="text-muted">Pago</dt>
            <dd>{policy.paymentStatus}</dd>
          </div>
          <div>
            <dt className="text-muted">Anexo</dt>
            <dd>{policy.annexNumber || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Factura</dt>
            <dd>{policy.invoiceNumber || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Vigencia</dt>
            <dd>{policy.startsAt || "—"} → {policy.endsAt || "—"}</dd>
          </div>
          {isCancelled && (
            <div>
              <dt className="text-muted">Cancelación</dt>
              <dd>
                {policy.cancelledAt} ·{" "}
                <span className="tabular-nums">
                  {policy.cancelledPremiumCents != null ? formatUSD(policy.cancelledPremiumCents) : "—"}
                </span>
              </dd>
            </div>
          )}
        </dl>

        {policy.lifecycleStatus === "CANCELACION_PENDIENTE" && (
          <div className="mt-4 border-t border-border pt-4">
            <ConfirmCancellationButton policyId={policy.id} />
          </div>
        )}

        {!isCancelled && (
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-4">
            {!policy.policyNumber && <SetPolicyNumberForm policyId={policy.id} />}
            {policy.issueStatus !== "EMITIDA" && <IssueStatusForm policyId={policy.id} current={policy.issueStatus} />}
            {policy.paymentStatus === "PENDIENTE" && <MarkPolicyPaidButton policyId={policy.id} />}
            <a href={`/siniestros/nuevo?policyId=${policy.id}`} className="text-xs font-semibold text-link underline">
              Reportar siniestro
            </a>
          </div>
        )}
      </section>

      <section className="mb-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Comisión</h2>
        {commission ? (
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <div>
              Base {formatUSD(commission.baseAmountCents)} ·{" "}
              {commission.percent ? `${commission.percent}%` : "sin % todavía"} ·{" "}
              {commission.amountCents != null ? formatUSD(commission.amountCents) : "—"} ·{" "}
              <span className={commission.status === "COMISIONADA" ? "text-green-700" : "text-amber-700"}>
                {commission.status}
              </span>
            </div>
            {commission.status === "PENDIENTE" && (
              <div className="flex items-center gap-3">
                <SetCommissionForm commissionId={commission.id} />
                {commission.percent && <MarkCommissionPaidButton commissionId={commission.id} />}
              </div>
            )}
            {commission.discountStatus && (
              <div className="flex w-full flex-wrap items-center justify-between gap-4 border-t border-border pt-3">
                <div>
                  Descuento por cancelación ·{" "}
                  {commission.discountAmountCents != null ? (
                    <span className="tabular-nums">{formatUSD(commission.discountAmountCents)}</span>
                  ) : (
                    "fija el % para calcularlo"
                  )}{" "}
                  ·{" "}
                  <span className={commission.discountStatus === "DESCONTADA" ? "text-good" : "text-warn"}>
                    {commission.discountStatus}
                  </span>
                </div>
                {commission.discountStatus === "PENDIENTE" && (
                  <MarkCommissionDiscountedButton commissionId={commission.id} policyId={policy.id} />
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Sin registro de comisión.</p>
        )}
      </section>

      <section className="mb-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Cuotas</h2>
        {installments.length === 0 ? (
          !isCancelled && policy.premiumCents != null && (
            <GenerateInstallmentsForm policyId={policy.id} premiumDollars={centsToDollars(policy.premiumCents)} />
          )
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted">
                <th className="py-2">#</th>
                <th className="py-2">Vencimiento</th>
                <th className="py-2 text-right">Monto</th>
                <th className="py-2 text-right">Estado</th>
              </tr>
            </thead>
            <tbody>
              {installments.map((inst) => (
                <tr key={inst.id} className="border-b border-border last:border-0">
                  <td className="py-2">{inst.installmentNumber}</td>
                  <td className="py-2">{inst.dueDate || "—"}</td>
                  <td className="py-2 text-right tabular-nums">{formatUSD(inst.amountCents)}</td>
                  <td className="py-2 text-right">
                    {inst.isPaid ? (
                      <span className="text-xs font-semibold text-green-700">Pagada</span>
                    ) : (
                      <MarkInstallmentPaidButton installmentId={inst.id} policyId={policy.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {!isCancelled && (
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Cancelar póliza</h2>
          <CancelPolicyForm
            policyId={policy.id}
            premiumDollars={policy.premiumCents != null ? centsToDollars(policy.premiumCents) : null}
          />
        </section>
      )}
    </main>
  );
}
