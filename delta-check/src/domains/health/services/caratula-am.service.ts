import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import type { Db } from "@/db";
import { quoteOptions, quoteRisks, quotes } from "@/db/schema/quoting";
import { clients, insuredGroups, insuredMembers } from "@/db/schema/clients";
import { insurers, healthPlanCoverages } from "@/db/schema/catalog";
import { calculateHealthDiscounts } from "./health-discount.calculator";

export type CaratulaAMCoverageRow = {
  section: string;
  label: string;
  displayOrder: number;
  copago: string | null;
  sublimite: string | null;
  carencia: string | null;
};

export type CaratulaAMOffer = {
  insurerName: string;
  planCode: string;
  netPremiumCents: number;
  emissionFeeCents: number;
  campesinoCents: number;
  totalPremiumCents: number;
  /**
   * Grilla real de sublímites/copago/carencia (`health_plan_coverages`,
   * extraída de OFERTA AM) — vacío si el plan no tiene fila sembrada
   * todavía (nunca se fabrica una grilla).
   */
  coverages: CaratulaAMCoverageRow[];
  /** ítem 69/71/73 de OFERTA AM — ver health-discount.calculator.ts. */
  sinDescuentoCents: number;
  conDescuentoEspecialCents: number | null;
  conDescuentoContadoCents: number | null;
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
      insurerId: insurers.id,
      insurerCode: insurers.code,
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

  // Grilla real de coberturas (health_plan_coverages) para cada oferta —
  // una consulta por (insurerId, planCode), agrupada después.
  const coverageRows = await Promise.all(
    pricedOffers.map((o) =>
      o.planCode
        ? tx
            .select({
              section: healthPlanCoverages.section,
              label: healthPlanCoverages.label,
              displayOrder: healthPlanCoverages.displayOrder,
              copago: healthPlanCoverages.copago,
              sublimite: healthPlanCoverages.sublimite,
              carencia: healthPlanCoverages.carencia,
            })
            .from(healthPlanCoverages)
            .where(and(eq(healthPlanCoverages.insurerId, o.insurerId), eq(healthPlanCoverages.planCode, o.planCode)))
            .orderBy(asc(healthPlanCoverages.displayOrder))
        : Promise.resolve([]),
    ),
  );

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
    offers: pricedOffers.map((o, i) => {
      const netPremiumCents = o.netPremiumCents ?? 0;
      const emissionFeeCents = o.emissionFeeCents ?? 0;
      const totalPremiumCents = o.totalPremiumCents ?? 0;
      const discounts = calculateHealthDiscounts(
        o.insurerCode,
        o.planCode ?? "",
        memberRows.length,
        netPremiumCents,
        emissionFeeCents,
        totalPremiumCents,
      );
      return {
        insurerName: o.insurerName,
        planCode: o.planCode ?? "-",
        netPremiumCents,
        emissionFeeCents,
        campesinoCents: o.campesinoCents ?? 0,
        totalPremiumCents,
        coverages: coverageRows[i],
        ...discounts,
      };
    }),
  };
}
