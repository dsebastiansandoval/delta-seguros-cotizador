import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { Db } from "@/db";
import { quoteOptions, quoteRisks, quotes } from "@/db/schema/quoting";
import { clients, insuredGroups, insuredMembers } from "@/db/schema/clients";
import { insurers } from "@/db/schema/catalog";

export type CaratulaAMOffer = {
  insurerName: string;
  planCode: string;
  netPremiumCents: number;
  emissionFeeCents: number;
  campesinoCents: number;
  totalPremiumCents: number;
};

export type CaratulaAMMember = { relation: "TITULAR" | "DEPENDIENTE"; age: number; gender: "MASCULINO" | "FEMENINO" };

export type CaratulaAMData = {
  quoteCode: string;
  date: string;
  clientName: string;
  clientDocument: string;
  region: "SIERRA" | "COSTA" | "AUSTRO";
  members: CaratulaAMMember[];
  coverPageValidity: { from: string; to: string };
  offers: CaratulaAMOffer[];
};

/**
 * Equivalente de Salud a `caratula.service.ts` — a diferencia de la hoja
 * `CARATULA` de Autos, `CARATULA AM` está completamente vacía en el Excel
 * (0 celdas con contenido, solo la imagen flotante de portada — confirmado
 * abriendo el libro real) — no hay ningún texto de saludo/coberturas que
 * extraer de ahí. El texto de la carta acá es redactado de nuevo, con el
 * mismo tono y estructura que la carta real de Autos, no una copia de una
 * fórmula real como en `caratula.service.ts`. Los números (prima neta,
 * OTROS CARGOS, 0.5% campesino, total) sí son reales — ver
 * `health-comparison.service.ts` y ARCHITECTURE.md §31.
 */
export async function getCaratulaAMData(
  tx: Db,
  quoteId: string,
  quoteOptionIds?: string[],
): Promise<CaratulaAMData | null> {
  const [quote] = await tx.select().from(quotes).where(and(eq(quotes.id, quoteId), eq(quotes.branch, "SALUD"))).limit(1);
  if (!quote) return null;

  const [client] = await tx.select().from(clients).where(eq(clients.id, quote.clientId)).limit(1);
  if (!client) return null;

  const [risk] = await tx.select().from(quoteRisks).where(eq(quoteRisks.quoteId, quoteId)).limit(1);
  if (!risk || !risk.insuredGroupId) return null;

  const [group] = await tx.select().from(insuredGroups).where(eq(insuredGroups.id, risk.insuredGroupId)).limit(1);
  if (!group) return null;

  const memberRows = await tx.select().from(insuredMembers).where(eq(insuredMembers.groupId, group.id));
  if (!memberRows.length) return null;

  const baseQuery = tx
    .select({
      quoteOptionId: quoteOptions.id,
      insurerName: insurers.name,
      planCode: quoteOptions.planCode,
      netPremiumCents: quoteOptions.netPremiumCents,
      emissionFeeCents: quoteOptions.emissionFeeCents,
      campesinoCents: quoteOptions.campesinoCents,
      totalPremiumCents: quoteOptions.totalPremiumCents,
    })
    .from(quoteOptions)
    .innerJoin(insurers, eq(insurers.id, quoteOptions.insurerId));

  const hasSelection = quoteOptionIds != null && quoteOptionIds.length > 0;
  const offersRaw = hasSelection
    ? await baseQuery.where(and(eq(quoteOptions.quoteRiskId, risk.id), inArray(quoteOptions.id, quoteOptionIds)))
    : await baseQuery
        .where(and(eq(quoteOptions.quoteRiskId, risk.id), isNotNull(quoteOptions.totalPremiumCents)))
        .orderBy(quoteOptions.totalPremiumCents)
        .limit(1);

  const pricedOffers = offersRaw.filter((o) => o.totalPremiumCents != null);
  if (!pricedOffers.length) return null;

  const clientName =
    client.personType === "JURIDICA"
      ? (client.businessName ?? "-")
      : `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "-";

  const today = new Date();
  const nextYear = new Date(today);
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const ddmmyyyy = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

  return {
    quoteCode: quote.code,
    date: new Date().toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric" }),
    clientName,
    clientDocument: client.documentNumber,
    region: group.region,
    members: memberRows.map((m) => ({ relation: m.relation, age: m.age, gender: m.gender })),
    coverPageValidity: { from: ddmmyyyy(today), to: ddmmyyyy(nextYear) },
    offers: pricedOffers.map((o) => ({
        insurerName: o.insurerName,
        planCode: o.planCode ?? "-",
        netPremiumCents: o.netPremiumCents ?? 0,
        emissionFeeCents: o.emissionFeeCents ?? 0,
        campesinoCents: o.campesinoCents ?? 0,
        totalPremiumCents: o.totalPremiumCents ?? 0,
      })),
  };
}
