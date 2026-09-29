import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { Db } from "@/db";
import { quoteOptionCoverages, quoteOptions, quoteRisks, quotes } from "@/db/schema/quoting";
import { clients, vehicles } from "@/db/schema/clients";
import { coverages, insurers } from "@/db/schema/catalog";
import { formatUSD } from "@/domains/shared/money";

export type CaratulaOfferCoverage = { name: string; display: string };

export type CaratulaOffer = {
  insurerName: string;
  kmBracket: number | null;
  netPremiumCents: number;
  superBancosCents: number;
  campesinoCents: number;
  emissionFeeCents: number;
  ivaCents: number;
  totalPremiumCents: number;
  /**
   * Coberturas reales cargadas a mano para esta oferta puntual (ítem 8,
   * ARCHITECTURE.md §30, `quote_option_coverages` — pantalla "Coberturas"
   * del comparador). Vacío si nadie cargó nada todavía para esta
   * aseguradora — en ese caso el PDF sigue mostrando el párrafo genérico
   * de coberturas (`COVERAGE_TEXT`), nunca una tabla vacía.
   */
  coverages: CaratulaOfferCoverage[];
};

export type CaratulaData = {
  quoteCode: string;
  date: string;
  clientName: string;
  clientDocument: string;
  vehiclePlate: string;
  vehicleLabel: string; // "Toyota Fortuner 2023"
  insuredValueCents: number;
  extrasValueCents: number;
  /**
   * Vigencia proyectada para la portada (hoy → hoy + 1 año), no una fecha
   * de póliza confirmada — eso solo existe recién en Emisión
   * (`policies.startsAt`/`endsAt`, ver EmitPolicyForm). Se calcula acá
   * porque el pedido explícito del usuario fue usar la portada real del
   * Excel (item 10/11 del feedback), que sí muestra un rango de fechas —
   * mostrar "1 año desde hoy" es una proyección razonable para una
   * cotización ANUAL (el caso normal), no un dato inventado sobre el
   * cliente. Formato `DD/MM/AAAA` igual al ejemplo real (WhatsApp).
   */
  coverPageValidity: { from: string; to: string };
  /**
   * Una o varias aseguradoras — el pedido original del Excel (hoja
   * `CARATULA`) siempre fue una sola, "la recomendada" (la más barata ya
   * COTIZADA). A pedido del usuario, ahora también se puede armar con
   * varias aseguradoras elegidas a mano en el comparador — una página por
   * cada una, mismo formato. `offers.length === 1` sigue siendo el caso
   * por defecto (nadie eligió nada, se manda la más barata).
   */
  offers: CaratulaOffer[];
  /**
   * Matiz de renovación (hoja `CARATULA!C14`, fórmula real: `=IF(DATOS
   * VH!$B$4="COTIZACIÓN", INFO GENERAL!$G$9, INFO GENERAL!$G$12)`) — el
   * saludo de la carta es DISTINTO si es una renovación, y menciona la
   * aseguradora/fecha de vencimiento de la póliza anterior. `null` cuando
   * `operationType` es NUEVA o cuando faltan los datos de la póliza
   * anterior (nunca se arma la frase con un hueco).
   */
  renewal: { previousInsurerName: string; previousExpiryDate: string } | null;
};

/**
 * Junta lo necesario para la carátula (equivalente a la hoja `CARATULA` del
 * Excel, EXCEL-AUDIT.md). Sin `quoteOptionIds`, agarra automático la oferta
 * más barata ya COTIZADA — "recomendada" es la misma noción de ★ que ya se
 * ve en el comparador. Con `quoteOptionIds`, arma la carátula con
 * exactamente esas aseguradoras (elegidas a mano en el comparador),
 * ignorando cualquiera que no tenga prima calculada o que no sea de esta
 * cotización — nunca se fabrica una cifra para una opción PENDIENTE_MANUAL.
 * Si nadie cotizó nada todavía, no hay carátula que generar — se devuelve
 * null en vez de fabricar algo.
 */
export async function getCaratulaData(
  tx: Db,
  quoteId: string,
  quoteOptionIds?: string[],
): Promise<CaratulaData | null> {
  const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
  if (!quote) return null;

  const [client] = await tx.select().from(clients).where(eq(clients.id, quote.clientId)).limit(1);
  if (!client) return null;

  // Una cotización puede traer 1-4 riesgos (vehículos, EXCEL-AUDIT.md §5).
  // Con selección, la carátula es del riesgo al que pertenecen esas
  // opciones (join por quote_risk_id) — nunca se asume "el riesgo 1" si el
  // agente eligió aseguradoras de otro vehículo. Sin selección (el default
  // de siempre), se mantiene riesgo 1 — el caso normal de una cotización
  // de un solo vehículo.
  const risk =
    quoteOptionIds && quoteOptionIds.length > 0
      ? (
          await tx
            .select({ risk: quoteRisks })
            .from(quoteOptions)
            .innerJoin(quoteRisks, eq(quoteRisks.id, quoteOptions.quoteRiskId))
            .where(and(eq(quoteRisks.quoteId, quoteId), inArray(quoteOptions.id, quoteOptionIds)))
            .limit(1)
        )[0]?.risk
      : (await tx.select().from(quoteRisks).where(and(eq(quoteRisks.quoteId, quoteId), eq(quoteRisks.riskNumber, 1))).limit(1))[0];
  if (!risk || !risk.vehicleId) return null;

  const [vehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, risk.vehicleId)).limit(1);
  if (!vehicle) return null;

  const baseQuery = tx
    .select({
      quoteOptionId: quoteOptions.id,
      insurerName: insurers.name,
      kmBracket: quoteOptions.kmBracket,
      netPremiumCents: quoteOptions.netPremiumCents,
      superBancosCents: quoteOptions.superBancosCents,
      campesinoCents: quoteOptions.campesinoCents,
      emissionFeeCents: quoteOptions.emissionFeeCents,
      ivaCents: quoteOptions.ivaCents,
      totalPremiumCents: quoteOptions.totalPremiumCents,
    })
    .from(quoteOptions)
    .innerJoin(insurers, eq(insurers.id, quoteOptions.insurerId));

  const hasSelection = quoteOptionIds != null && quoteOptionIds.length > 0;
  const offersRaw = hasSelection
    ? await baseQuery.where(
        and(
          eq(quoteOptions.quoteRiskId, risk.id),
          isNotNull(quoteOptions.totalPremiumCents),
          inArray(quoteOptions.id, quoteOptionIds),
        ),
      )
    : await baseQuery
        .where(and(eq(quoteOptions.quoteRiskId, risk.id), isNotNull(quoteOptions.totalPremiumCents)))
        .orderBy(quoteOptions.totalPremiumCents)
        .limit(1);

  if (!offersRaw.length) return null;

  // Coberturas reales cargadas a mano (pantalla "Coberturas" del
  // comparador, §30) — una consulta para todas las ofertas de esta
  // carátula, agrupada después por quoteOptionId.
  const coverageRows = await tx
    .select({
      quoteOptionId: quoteOptionCoverages.quoteOptionId,
      valueType: coverages.valueType,
      name: coverages.name,
      displayOrder: coverages.displayOrder,
      granted: quoteOptionCoverages.granted,
      amountCents: quoteOptionCoverages.amountCents,
      textValue: quoteOptionCoverages.textValue,
    })
    .from(quoteOptionCoverages)
    .innerJoin(coverages, eq(coverages.id, quoteOptionCoverages.coverageId))
    .where(
      inArray(
        quoteOptionCoverages.quoteOptionId,
        offersRaw.map((o) => o.quoteOptionId),
      ),
    )
    .orderBy(coverages.displayOrder);

  const coveragesByOption = new Map<string, CaratulaOfferCoverage[]>();
  for (const row of coverageRows) {
    let display: string | null = null;
    if (row.valueType === "BOOLEAN" && row.granted) display = "Sí otorga";
    else if (row.valueType === "AMOUNT" && row.amountCents != null) display = formatUSD(row.amountCents);
    else if (row.valueType === "TEXT" && row.textValue) display = row.textValue;
    if (!display) continue;
    const list = coveragesByOption.get(row.quoteOptionId) ?? [];
    list.push({ name: row.name, display });
    coveragesByOption.set(row.quoteOptionId, list);
  }

  const clientName =
    client.personType === "JURIDICA"
      ? (client.businessName ?? "-")
      : `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "-";

  const today = new Date();
  const nextYear = new Date(today);
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const ddmmyyyy = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

  let renewal: CaratulaData["renewal"] = null;
  if (quote.operationType === "RENOVACION" && quote.previousInsurerId && quote.previousExpiryDate) {
    const [previousInsurer] = await tx.select().from(insurers).where(eq(insurers.id, quote.previousInsurerId)).limit(1);
    if (previousInsurer) {
      renewal = {
        previousInsurerName: previousInsurer.name,
        // `previousExpiryDate` es `date` de Postgres (string "AAAA-MM-DD");
        // se arma la fecha con las partes del string, no con `new Date()`
        // directo — un `Date` interpreta esa cadena en UTC y puede mostrar
        // el día anterior según el huso horario del servidor.
        previousExpiryDate: (() => {
          const [y, m, d] = quote.previousExpiryDate.split("-").map(Number);
          return new Date(y, m - 1, d).toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric" });
        })(),
      };
    }
  }

  return {
    quoteCode: quote.code,
    date: new Date().toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric" }),
    clientName,
    clientDocument: client.documentNumber,
    vehiclePlate: vehicle.plate,
    vehicleLabel: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
    insuredValueCents: risk.insuredValueCents ?? 0,
    extrasValueCents: risk.extrasValueCents ?? 0,
    coverPageValidity: { from: ddmmyyyy(today), to: ddmmyyyy(nextYear) },
    renewal,
    offers: offersRaw.map((o) => ({
      insurerName: o.insurerName,
      kmBracket: o.kmBracket,
      netPremiumCents: o.netPremiumCents ?? 0,
      superBancosCents: o.superBancosCents ?? 0,
      campesinoCents: o.campesinoCents ?? 0,
      emissionFeeCents: o.emissionFeeCents ?? 0,
      ivaCents: o.ivaCents ?? 0,
      totalPremiumCents: o.totalPremiumCents ?? 0,
      coverages: coveragesByOption.get(o.quoteOptionId) ?? [],
    })),
  };
}
