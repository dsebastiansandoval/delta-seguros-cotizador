import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { Db } from "@/db";
import { quoteOptions, quoteRisks, quotes } from "@/db/schema/quoting";
import { clients, vehicles } from "@/db/schema/clients";
import { insurers } from "@/db/schema/catalog";

export type CaratulaOffer = {
  insurerName: string;
  netPremiumCents: number;
  superBancosCents: number;
  campesinoCents: number;
  emissionFeeCents: number;
  ivaCents: number;
  totalPremiumCents: number;
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
   * Una o varias aseguradoras — el pedido original del Excel (hoja
   * `CARATULA`) siempre fue una sola, "la recomendada" (la más barata ya
   * COTIZADA). A pedido del usuario, ahora también se puede armar con
   * varias aseguradoras elegidas a mano en el comparador — una página por
   * cada una, mismo formato. `offers.length === 1` sigue siendo el caso
   * por defecto (nadie eligió nada, se manda la más barata).
   */
  offers: CaratulaOffer[];
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

  const [risk] = await tx.select().from(quoteRisks).where(eq(quoteRisks.quoteId, quoteId)).limit(1);
  if (!risk || !risk.vehicleId) return null;

  const [vehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, risk.vehicleId)).limit(1);
  if (!vehicle) return null;

  const baseQuery = tx
    .select({
      insurerName: insurers.name,
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

  const clientName =
    client.personType === "JURIDICA"
      ? (client.businessName ?? "-")
      : `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "-";

  return {
    quoteCode: quote.code,
    date: new Date().toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric" }),
    clientName,
    clientDocument: client.documentNumber,
    vehiclePlate: vehicle.plate,
    vehicleLabel: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
    insuredValueCents: risk.insuredValueCents ?? 0,
    extrasValueCents: risk.extrasValueCents ?? 0,
    offers: offersRaw.map((o) => ({
      insurerName: o.insurerName,
      netPremiumCents: o.netPremiumCents ?? 0,
      superBancosCents: o.superBancosCents ?? 0,
      campesinoCents: o.campesinoCents ?? 0,
      emissionFeeCents: o.emissionFeeCents ?? 0,
      ivaCents: o.ivaCents ?? 0,
      totalPremiumCents: o.totalPremiumCents ?? 0,
    })),
  };
}
