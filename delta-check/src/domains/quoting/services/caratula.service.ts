import { and, eq, isNotNull } from "drizzle-orm";
import type { Db } from "@/db";
import { quoteOptions, quoteRisks, quotes } from "@/db/schema/quoting";
import { clients, vehicles } from "@/db/schema/clients";
import { insurers } from "@/db/schema/catalog";

export type CaratulaData = {
  quoteCode: string;
  date: string;
  clientName: string;
  clientDocument: string;
  vehiclePlate: string;
  vehicleLabel: string; // "Toyota Fortuner 2023"
  insuredValueCents: number;
  extrasValueCents: number;
  insurerName: string;
  netPremiumCents: number;
  superBancosCents: number;
  campesinoCents: number;
  emissionFeeCents: number;
  ivaCents: number;
  totalPremiumCents: number;
};

/**
 * Junta lo necesario para la carátula (equivalente a la hoja `CARATULA` del
 * Excel, EXCEL-AUDIT.md) a partir de la oferta más barata ya COTIZADA —
 * "recomendada" es la misma noción de ★ que ya se ve en el comparador.
 * Si nadie cotizó nada todavía (todo PENDIENTE_MANUAL), no hay carátula
 * que generar — se devuelve null en vez de fabricar una cifra.
 */
export async function getCaratulaData(tx: Db, quoteId: string): Promise<CaratulaData | null> {
  const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
  if (!quote) return null;

  const [client] = await tx.select().from(clients).where(eq(clients.id, quote.clientId)).limit(1);
  if (!client) return null;

  const [risk] = await tx.select().from(quoteRisks).where(eq(quoteRisks.quoteId, quoteId)).limit(1);
  if (!risk || !risk.vehicleId) return null;

  const [vehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, risk.vehicleId)).limit(1);
  if (!vehicle) return null;

  const bestOption = await tx
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
    .innerJoin(insurers, eq(insurers.id, quoteOptions.insurerId))
    .where(and(eq(quoteOptions.quoteRiskId, risk.id), isNotNull(quoteOptions.totalPremiumCents)))
    .orderBy(quoteOptions.totalPremiumCents)
    .limit(1);

  if (!bestOption[0]) return null;
  const best = bestOption[0];

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
    insurerName: best.insurerName,
    netPremiumCents: best.netPremiumCents ?? 0,
    superBancosCents: best.superBancosCents ?? 0,
    campesinoCents: best.campesinoCents ?? 0,
    emissionFeeCents: best.emissionFeeCents ?? 0,
    ivaCents: best.ivaCents ?? 0,
    totalPremiumCents: best.totalPremiumCents ?? 0,
  };
}
