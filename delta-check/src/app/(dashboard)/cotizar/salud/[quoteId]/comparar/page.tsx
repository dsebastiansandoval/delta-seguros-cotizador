import Link from "next/link";
import { notFound } from "next/navigation";
import { getHealthOfferSheet, getHealthQuoteComparison } from "@/actions/health-quote.actions";
import { coverageRows, coverageValueFor, memberLabels, planLabel } from "@/domains/health/services/health-offer-format";
import { formatUSD } from "@/domains/shared/money";

const labelCell = "sticky left-0 z-10 bg-surface px-3 py-1.5 text-left text-xs font-semibold";
const dataCell = "px-3 py-1.5 text-center text-xs";

function Section({ title, span }: { title: string; span: number }) {
  return (
    <tr className="bg-delta-navy text-white">
      <th colSpan={span} className="sticky left-0 px-3 py-1.5 text-left text-xs font-bold uppercase tracking-wide">
        {title}
      </th>
    </tr>
  );
}

/** Comparativa de Salud en el formato de la hoja OFERTA AM. */
export default async function CompararSaludPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const [comparison, sheet] = await Promise.all([getHealthQuoteComparison(quoteId), getHealthOfferSheet(quoteId)]);
  if (!comparison) notFound();

  const offers = sheet?.offers ?? [];
  const span = offers.length + 1;
  const labels = sheet ? memberLabels(sheet.members) : [];

  const money = (cents: number | null) => (cents != null ? formatUSD(cents) : "N/A");

  return (
    <main className="mx-auto max-w-[1400px] p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Comparativa Salud — {comparison.quote.code}</h1>
          <p className="mt-1 text-sm text-muted">{offers.length} planes en la oferta</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link href={`/cotizar/salud/${quoteId}/configurar`} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">
            Configurar oferta
          </Link>
          {offers.length > 0 && (
            <a
              href={`/api/quotes/${quoteId}/caratula-am`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-delta-navy px-4 py-2 text-sm font-semibold text-white"
            >
              Descargar oferta PDF
            </a>
          )}
        </div>
      </header>

      {offers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted">
          Ningún plan está marcado para mostrarse — elígelos en &quot;Configurar oferta&quot;.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={labelCell} />
                {offers.map((o) => (
                  <th key={o.quoteOptionId} className="min-w-40 px-3 py-2 text-center text-xs font-bold uppercase">
                    {o.insurerName}
                    <span className="block text-[10px] font-semibold text-muted">{planLabel(o.planCode)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {coverageRows(offers).map(({ label, section, showSectionHeader }) => [
                showSectionHeader && <Section key={`s-${section}`} title={section.replace(/_/g, " ")} span={span} />,
                <tr key={label}>
                  <th className={labelCell}>{label}</th>
                  {offers.map((o) => (
                    <td key={o.quoteOptionId} className={dataCell}>
                      {coverageValueFor(o, label)}
                    </td>
                  ))}
                </tr>,
              ])}

              <Section title="Titular — dependientes" span={span} />
              {labels.map((label, m) => (
                <tr key={label}>
                  <th className={labelCell}>{label}</th>
                  {offers.map((o) => (
                    <td key={o.quoteOptionId} className={`${dataCell} tabular-nums`}>
                      {o.memberPremiumsCents[m] != null ? formatUSD(o.memberPremiumsCents[m]!) : ""}
                    </td>
                  ))}
                </tr>
              ))}
              {(
                [
                  ["PRIMA NETA", (o) => formatUSD(o.netPremiumCents)],
                  ["OTROS CARGOS", (o) => formatUSD(o.emissionFeeCents)],
                  ["SUBTOTAL", (o) => formatUSD(o.netPremiumCents + o.emissionFeeCents)],
                  ["0.50% SEGURO CAMPESINO", (o) => formatUSD(o.campesinoCents)],
                ] as const satisfies ReadonlyArray<readonly [string, (o: (typeof offers)[number]) => string]>
              ).map(([label, fmt]) => (
                <tr key={label}>
                  <th className={labelCell}>{label}</th>
                  {offers.map((o) => (
                    <td key={o.quoteOptionId} className={`${dataCell} tabular-nums`}>
                      {fmt(o)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-warn-bg">
                <th className={`${labelCell} bg-warn-bg font-bold`}>PRIMA TOTAL</th>
                {offers.map((o) => (
                  <td key={o.quoteOptionId} className={`${dataCell} font-bold tabular-nums text-link`}>
                    {formatUSD(o.totalPremiumCents)}
                  </td>
                ))}
              </tr>

              <Section title="Valor mensual" span={span} />
              <tr>
                <th className={labelCell}>Total sin descuento</th>
                {offers.map((o) => (
                  <td key={o.quoteOptionId} className={`${dataCell} tabular-nums`}>{money(o.sinDescuentoCents)}</td>
                ))}
              </tr>
              <tr>
                <th className={labelCell}>Total con descuento especial</th>
                {offers.map((o) => (
                  <td key={o.quoteOptionId} className={`${dataCell} tabular-nums`}>{money(o.conDescuentoEspecialCents)}</td>
                ))}
              </tr>
              <tr>
                <th className={labelCell}>Total con descuento de contado</th>
                {offers.map((o) => (
                  <td key={o.quoteOptionId} className={`${dataCell} tabular-nums`}>{money(o.conDescuentoContadoCents)}</td>
                ))}
              </tr>

              <Section title="Formas de pago" span={span} />
              <tr>
                <th className={labelCell}>Tarjeta de crédito (sin intereses)</th>
                {offers.map((o) => (
                  <td key={o.quoteOptionId} className={dataCell}>Hasta 12 meses</td>
                ))}
              </tr>
              <tr>
                <th className={`${labelCell} text-muted`}>Emitir póliza</th>
                {offers.map((o) => (
                  <td key={o.quoteOptionId} className={dataCell}>
                    <Link href={`/cartera/emitir?quoteOptionId=${o.quoteOptionId}`} className="text-[11px] font-semibold text-link underline">
                      Emitir
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
