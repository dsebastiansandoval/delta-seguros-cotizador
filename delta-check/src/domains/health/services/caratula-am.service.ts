import { and, asc, eq, isNotNull, or } from "drizzle-orm";
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
  quoteOptionId: string;
  insurerCode: string;
  insurerName: string;
  planCode: string;
  netPremiumCents: number;
  emissionFeeCents: number;
  campesinoCents: number;
  totalPremiumCents: number;
  /** Prima de cada asegurado, en el mismo orden que `CaratulaAMData.members` (null si se digitó solo el total). */
  memberPremiumsCents: Array<number | null>;
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
// Orden de las columnas en OFERTA AM.
const INSURER_ORDER = ["BMI", "SALUD", "SALUDSA", "CONFIAMED", "HUMANA", "BUPA", "PRO", "VB"];

/**
 * Hoja OFERTA AM: los planes marcados "Mostrar" en la configuración, con la
 * prima de cada asegurado, cargos, descuentos y la grilla de coberturas. La
 * usan la comparativa web y el PDF (IMPRIMIR_OFERTA_AM).
 */
export async function getCaratulaAMData(tx: Db, quoteId: string): Promise<CaratulaAMData | null> {
  const [quote] = await tx.select().from(quotes).where(and(eq(quotes.id, quoteId), eq(quotes.branch, "SALUD"))).limit(1);
  if (!quote) return null;

  const [client] = await tx.select().from(clients).where(eq(clients.id, quote.clientId)).limit(1);
  if (!client) return null;

  const [risk] = await tx.select().from(quoteRisks).where(eq(quoteRisks.quoteId, quoteId)).limit(1);
  if (!risk || !risk.insuredGroupId) return null;

  const [group] = await tx.select().from(insuredGroups).where(eq(insuredGroups.id, risk.insuredGroupId)).limit(1);
  if (!group) return null;

  const memberRows = (await tx.select().from(insuredMembers).where(eq(insuredMembers.groupId, group.id))).sort(
    (a, b) => (a.relation === "TITULAR" ? -1 : 0) - (b.relation === "TITULAR" ? -1 : 0),
  );
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
      memberPremiums: quoteOptions.memberPremiums,
    })
    .from(quoteOptions)
    .innerJoin(insurers, eq(insurers.id, quoteOptions.insurerId));

  const pricedOffers = (
    await baseQuery.where(
      and(
        eq(quoteOptions.quoteRiskId, risk.id),
        eq(quoteOptions.includedInOffer, true),
        isNotNull(quoteOptions.totalPremiumCents),
      ),
    )
  ).sort(
    (a, b) =>
      INSURER_ORDER.indexOf(a.insurerCode) - INSURER_ORDER.indexOf(b.insurerCode) ||
      (a.planCode ?? "").localeCompare(b.planCode ?? "", "es", { numeric: true }),
  );
  if (!pricedOffers.length) return null;

  // Grilla real de coberturas (health_plan_coverages) para cada oferta — una
  // sola consulta con todos los pares (insurerId, planCode) en vez de una
  // por oferta: `tx` es el mismo cliente pg dentro de una transacción, y
  // varias queries concurrentes sobre el mismo cliente (el Promise.all de
  // antes) son justo lo que pg marca como deprecado — "Calling client.query()
  // when the client is already executing a query" — y en producción, con
  // más de una oferta en la carátula, terminaba sirviendo coberturas mezcladas
  // entre aseguradoras. Agrupar después en JS en vez de preguntarle a la BD.
  const planPairs = [...new Map(pricedOffers.filter((o) => o.planCode).map((o) => [`${o.insurerId}:${o.planCode}`, o])).values()];
  const allCoverageRows = planPairs.length
    ? await tx
        .select({
          insurerId: healthPlanCoverages.insurerId,
          planCode: healthPlanCoverages.planCode,
          section: healthPlanCoverages.section,
          label: healthPlanCoverages.label,
          displayOrder: healthPlanCoverages.displayOrder,
          copago: healthPlanCoverages.copago,
          sublimite: healthPlanCoverages.sublimite,
          carencia: healthPlanCoverages.carencia,
        })
        .from(healthPlanCoverages)
        .where(
          or(
            ...planPairs.map((p) => and(eq(healthPlanCoverages.insurerId, p.insurerId), eq(healthPlanCoverages.planCode, p.planCode!))),
          ),
        )
        .orderBy(asc(healthPlanCoverages.displayOrder))
    : [];
  const coverageRows: CaratulaAMCoverageRow[][] = pricedOffers.map((o) =>
    allCoverageRows
      .filter((r) => r.insurerId === o.insurerId && r.planCode === o.planCode)
      .map((r) => ({
        section: r.section,
        label: r.label,
        displayOrder: r.displayOrder,
        copago: r.copago,
        sublimite: r.sublimite,
        carencia: r.carencia,
      })),
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
        quoteOptionId: o.quoteOptionId,
        insurerCode: o.insurerCode,
        insurerName: o.insurerName,
        planCode: o.planCode ?? "-",
        netPremiumCents,
        emissionFeeCents,
        campesinoCents: o.campesinoCents ?? 0,
        totalPremiumCents,
        memberPremiumsCents: memberRows.map((m) => o.memberPremiums?.[m.id] ?? null),
        coverages: coverageRows[i],
        ...discounts,
      };
    }),
  };
}
