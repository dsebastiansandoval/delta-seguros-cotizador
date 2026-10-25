import Link from "next/link";
import type { OfferSheet } from "@/domains/quoting/offer/offer.service";
import { INSTALLMENT_TERMS, installmentCents } from "@/domains/quoting/offer/offer-sheet";
import {
  ADDITIONAL_ROWS,
  PREMIUM_ROWS,
  PRINCIPAL_ROWS,
  formatMoney,
  formatOfferCell,
  formatRate,
} from "@/domains/quoting/offer/offer-format";
import { formatUSD } from "@/domains/shared/money";
import { KM_BRACKET_LABELS } from "@/domains/quoting/constants";

const labelCell = "sticky left-0 z-10 bg-surface px-3 py-1.5 text-left text-xs font-semibold";
const dataCell = "px-3 py-1.5 text-center text-xs whitespace-pre-line";

function Section({ title, span }: { title: string; span: number }) {
  return (
    <tr className="bg-delta-navy text-white">
      <th colSpan={span} className="sticky left-0 px-3 py-1.5 text-left text-xs font-bold uppercase tracking-wide">
        {title}
      </th>
    </tr>
  );
}

/** Comparativa en el formato de la hoja OFERTA del Excel (u OFERTA KM para Auto x Km). */
export function OfferSheetView({ sheet }: { sheet: OfferSheet }) {
  return sheet.kind === "KM" ? <KmSheet sheet={sheet} /> : <AnnualSheet sheet={sheet} />;
}

function AnnualSheet({ sheet }: { sheet: Extract<OfferSheet, { kind: "ANUAL" }> }) {
  const { columns, risks } = sheet;
  if (!columns.length) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted">
        Ninguna aseguradora está marcada para mostrarse — actívalas en &quot;Configurar oferta&quot;.
      </p>
    );
  }
  const span = columns.length + 1;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className={labelCell} />
            {columns.map((c) => (
              <th key={c.insurerId} className="min-w-36 px-3 py-2 text-center text-xs font-bold uppercase">
                {c.insurerName}
                <span className="block text-[10px] font-semibold text-muted">Modalidad anual</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          <Section title="Coberturas principales" span={span} />
          {PRINCIPAL_ROWS.map((row) => (
            <tr key={row.key}>
              <th className={labelCell}>{row.label}</th>
              {columns.map((c) => (
                <td key={c.insurerId} className={dataCell}>{formatOfferCell(c.cells[row.key])}</td>
              ))}
            </tr>
          ))}

          <Section title="Coberturas adicionales" span={span} />
          {ADDITIONAL_ROWS.map((row) => (
            <tr key={row.key}>
              <th className={labelCell}>{row.label}</th>
              {columns.map((c) => (
                <td key={c.insurerId} className={dataCell}>{formatOfferCell(c.cells[row.key])}</td>
              ))}
            </tr>
          ))}

          <Section title="Deducibles" span={span} />
          <tr>
            <th className={labelCell}>Pérdidas Parciales</th>
            {columns.map((c) => (
              <td key={c.insurerId} className={`${dataCell} text-[11px]`}>{c.partialDeductible}</td>
            ))}
          </tr>
          <tr>
            <th className={labelCell}>Pérdida Total</th>
            {columns.map((c) => (
              <td key={c.insurerId} className={`${dataCell} text-[11px]`}>{c.totalLossDeductible}</td>
            ))}
          </tr>

          <Section title="Riesgos" span={span} />
          {risks.map((risk) => (
            <tr key={risk.id}>
              <th className={labelCell}>{risk.label}</th>
              {columns.map((c) => (
                <td key={c.insurerId} className={`${dataCell} tabular-nums`}>
                  {formatRate(c.risks.find((r) => r.riskNumber === risk.riskNumber)?.ratePercentApplied ?? null)}
                </td>
              ))}
            </tr>
          ))}

          {PREMIUM_ROWS.map(([label, field]) => (
            <tr key={field}>
              <th className={labelCell}>{label}</th>
              {columns.map((c) => (
                <td key={c.insurerId} className={`${dataCell} tabular-nums`}>{formatMoney(c.totals?.[field])}</td>
              ))}
            </tr>
          ))}
          <tr className="bg-warn-bg">
            <th className={`${labelCell} bg-warn-bg font-bold`}>PRIMA TOTAL</th>
            {columns.map((c) => (
              <td key={c.insurerId} className={`${dataCell} font-bold tabular-nums text-link`}>
                {formatMoney(c.totals?.totalPremiumCents)}
              </td>
            ))}
          </tr>

          <Section title="Formas de pago" span={span} />
          <tr>
            <th className={labelCell}>Efectivo o transferencia</th>
            {columns.map((c) => (
              <td key={c.insurerId} className={`${dataCell} tabular-nums`}>{formatMoney(c.totals?.totalPremiumCents)}</td>
            ))}
          </tr>
          {INSTALLMENT_TERMS.map((months) => (
            <tr key={months}>
              <th className={labelCell}>Tarjeta de crédito — {months} meses</th>
              {columns.map((c) => (
                <td key={c.insurerId} className={`${dataCell} tabular-nums`}>
                  {c.totals ? formatUSD(installmentCents(c.totals.totalPremiumCents, months)) : ""}
                </td>
              ))}
            </tr>
          ))}

          <tr>
            <th className={`${labelCell} text-muted`}>Emitir póliza</th>
            {columns.map((c) => (
              <td key={c.insurerId} className={dataCell}>
                {c.risks
                  .filter((r) => r.netPremiumCents != null)
                  .map((r) => (
                    <Link
                      key={r.quoteOptionId}
                      href={`/cartera/emitir?quoteOptionId=${r.quoteOptionId}`}
                      className="block text-[11px] font-semibold text-link underline"
                    >
                      {risks.length > 1 ? `Riesgo ${r.riskNumber}` : "Emitir"}
                    </Link>
                  ))}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function KmSheet({ sheet }: { sheet: Extract<OfferSheet, { kind: "KM" }> }) {
  const km = sheet.km;
  if (!km) return <p className="text-sm text-muted">Ninguna aseguradora tiene habilitado Auto x Km.</p>;

  return (
    <div className="flex flex-col gap-8">
      {sheet.risks.map((risk) => {
        const brackets = km.brackets.filter((b) => b.riskNumber === risk.riskNumber);
        const span = brackets.length + 1;
        return (
          <section key={risk.id}>
            {sheet.risks.length > 1 && (
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
                Riesgo {risk.riskNumber} — {risk.label}
              </h2>
            )}
            <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className={labelCell}>{km.insurerName} — Modalidad auto por kilómetro</th>
                    {brackets.map((b) => (
                      <th key={b.quoteOptionId} className="min-w-32 px-3 py-2 text-center text-xs font-bold">
                        {KM_BRACKET_LABELS[b.kmBracket as keyof typeof KM_BRACKET_LABELS]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <Section title="Coberturas" span={span} />
                  {km.rows.map((row) => (
                    <tr key={row.key}>
                      <th className={labelCell}>{row.label}</th>
                      <td colSpan={brackets.length} className={dataCell}>
                        {row.key === "RC"
                          ? formatOfferCell({ amount: (km.rcAmountCents ?? 0) / 100 })
                          : formatOfferCell("amount" in row ? { amount: row.amount } : { text: row.text })}
                      </td>
                    </tr>
                  ))}
                  <Section title="Deducibles" span={span} />
                  <tr>
                    <th className={labelCell}>Pérdidas Parciales</th>
                    <td colSpan={brackets.length} className={dataCell}>{km.partialDeductible}</td>
                  </tr>
                  <tr>
                    <th className={labelCell}>Pérdida Total</th>
                    <td colSpan={brackets.length} className={`${dataCell} text-[11px]`}>{km.totalLossDeductible}</td>
                  </tr>
                  <tr>
                    <th className={labelCell}>Tasa</th>
                    {brackets.map((b) => (
                      <td key={b.quoteOptionId} className={`${dataCell} tabular-nums`}>{formatRate(b.ratePercentApplied)}</td>
                    ))}
                  </tr>
                  {PREMIUM_ROWS.map(([label, field]) => (
                    <tr key={field}>
                      <th className={labelCell}>{label}</th>
                      {brackets.map((b) => (
                        <td key={b.quoteOptionId} className={`${dataCell} tabular-nums`}>{formatMoney(b.totals?.[field])}</td>
                      ))}
                    </tr>
                  ))}
                  <tr className="bg-warn-bg">
                    <th className={`${labelCell} bg-warn-bg font-bold`}>PRIMA TOTAL</th>
                    {brackets.map((b) => (
                      <td key={b.quoteOptionId} className={`${dataCell} font-bold tabular-nums text-link`}>
                        {formatMoney(b.totals?.totalPremiumCents)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th className={`${labelCell} text-muted`}>Emitir póliza</th>
                    {brackets.map((b) => (
                      <td key={b.quoteOptionId} className={dataCell}>
                        {b.totals && (
                          <Link href={`/cartera/emitir?quoteOptionId=${b.quoteOptionId}`} className="text-[11px] font-semibold text-link underline">
                            Emitir
                          </Link>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
