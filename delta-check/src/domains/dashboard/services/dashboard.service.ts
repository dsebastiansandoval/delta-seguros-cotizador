import { and, count, countDistinct, eq, gte, inArray, lt, lte, sum } from "drizzle-orm";
import type { Db } from "@/db";
import { quoteOptions, quoteRisks, quotes } from "@/db/schema/quoting";
import { policies, commissions, claims } from "@/db/schema/policies";
import { users } from "@/db/schema/identity";
import { buildAgentReport, type ReportMonth } from "./agent-report";

const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

/**
 * % de cambio vs. el mes anterior — `null` (no un 0% fabricado) cuando no
 * hay línea base (mes anterior en 0), mismo criterio que "nunca fabricar un
 * dato que no tenemos" del resto del proyecto.
 */
function monthOverMonth(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * KPIs — sin equivalente real en el Excel (`DASHBOARD`/`BASE DASHBOARD`
 * están completamente vacías, sin una sola fórmula COUNTIF/SUMIF que
 * defina qué métrica mostrar — confirmado al auditar Fase 3, EXCEL-AUDIT.md
 * §4). Estas métricas son diseño de Delta Check sobre los datos que el
 * propio dominio ya genera, no algo extraído del archivo original.
 */
export const dashboardService = {
  async getSummary(tx: Db, organizationId: string) {
    // Secuencial, no Promise.all: `tx` es una transacción sobre una única
    // conexión — lanzar varias queries a la vez en la misma conexión es
    // comportamiento deprecado del driver `pg` (avisa en consola y dejará
    // de funcionar en pg@9), aunque hoy "funcione" por casualidad.
    const quotesByStatus = await tx
      .select({ status: quotes.status, total: count() })
      .from(quotes)
      .where(eq(quotes.organizationId, organizationId))
      .groupBy(quotes.status);

    const quotesByBranch = await tx
      .select({ branch: quotes.branch, total: count() })
      .from(quotes)
      .where(eq(quotes.organizationId, organizationId))
      .groupBy(quotes.branch);

    const policyStats = await tx
      .select({
        lifecycleStatus: policies.lifecycleStatus,
        total: count(),
        primaCents: sum(policies.premiumCents),
      })
      .from(policies)
      .where(eq(policies.organizationId, organizationId))
      .groupBy(policies.lifecycleStatus);

    const comisionesStats = await tx
      .select({ status: commissions.status, total: count(), montoCents: sum(commissions.amountCents) })
      .from(commissions)
      .where(eq(commissions.organizationId, organizationId))
      .groupBy(commissions.status);

    const siniestrosByStatus = await tx
      .select({ status: claims.status, total: count(), valorCents: sum(claims.claimValueCents) })
      .from(claims)
      .where(eq(claims.organizationId, organizationId))
      .groupBy(claims.status);

    // Fila de KPI del mockup visual (Cotizador-Delta-MVP-visual.html,
    // ARCHITECTURE.md §26) — mismas 4 métricas, pero con números reales de
    // Postgres en vez de los datos de ejemplo de la maqueta. Sin
    // equivalente en el Excel (ver comentario de arriba), así que el corte
    // de "mes" es simple calendario, no una noción que venga de ahí.
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);

    const [quotesThisMonth] = await tx
      .select({ total: count() })
      .from(quotes)
      .where(and(eq(quotes.organizationId, organizationId), gte(quotes.createdAt, startOfThisMonth)));
    const [quotesLastMonth] = await tx
      .select({ total: count() })
      .from(quotes)
      .where(
        and(
          eq(quotes.organizationId, organizationId),
          gte(quotes.createdAt, startOfLastMonth),
          lt(quotes.createdAt, startOfThisMonth),
        ),
      );

    const [policiesThisMonth] = await tx
      .select({ total: count() })
      .from(policies)
      .where(and(eq(policies.organizationId, organizationId), gte(policies.createdAt, startOfThisMonth)));
    const [policiesLastMonth] = await tx
      .select({ total: count() })
      .from(policies)
      .where(
        and(
          eq(policies.organizationId, organizationId),
          gte(policies.createdAt, startOfLastMonth),
          lt(policies.createdAt, startOfThisMonth),
        ),
      );

    const [renovacionesProximas] = await tx
      .select({ total: count() })
      .from(policies)
      .where(
        and(
          eq(policies.organizationId, organizationId),
          eq(policies.lifecycleStatus, "VIGENTE"),
          gte(policies.endsAt, toDateStr(now)),
          lte(policies.endsAt, toDateStr(in30Days)),
        ),
      );

    // `commissions` no tiene su propia fecha (EXCEL-AUDIT.md §2.5) — se usa
    // la fecha de la póliza que la generó, que es cuando en la práctica
    // nace la comisión.
    const [comisionThisMonth] = await tx
      .select({ total: sum(commissions.amountCents) })
      .from(commissions)
      .innerJoin(policies, eq(policies.id, commissions.policyId))
      .where(and(eq(commissions.organizationId, organizationId), gte(policies.createdAt, startOfThisMonth)));
    const [comisionLastMonth] = await tx
      .select({ total: sum(commissions.amountCents) })
      .from(commissions)
      .innerJoin(policies, eq(policies.id, commissions.policyId))
      .where(
        and(
          eq(commissions.organizationId, organizationId),
          gte(policies.createdAt, startOfLastMonth),
          lt(policies.createdAt, startOfThisMonth),
        ),
      );

    const quotesTotal = quotesByStatus.reduce((sum, r) => sum + r.total, 0);
    // Toda póliza (vigente o cancelada) implica que la cotización llegó a
    // emitirse — la cancelación es un evento posterior, no anula el hecho.
    const policiesEmitidas = policyStats.reduce((sum, r) => sum + r.total, 0);
    const conversionRate = quotesTotal > 0 ? policiesEmitidas / quotesTotal : 0;

    return {
      quotes: { total: quotesTotal, byStatus: quotesByStatus, byBranch: quotesByBranch },
      conversion: { quotesTotal, policiesEmitidas, rate: conversionRate },
      cartera: {
        vigentes: policyStats.find((r) => r.lifecycleStatus === "VIGENTE")?.total ?? 0,
        // Una cancelación pedida (aún sin confirmar por la aseguradora) ya cuenta como cancelada.
        canceladas: policyStats
          .filter((r) => r.lifecycleStatus === "CANCELADA" || r.lifecycleStatus === "CANCELACION_PENDIENTE")
          .reduce((sum, r) => sum + r.total, 0),
        primaVigenteCents: Number(policyStats.find((r) => r.lifecycleStatus === "VIGENTE")?.primaCents ?? 0),
      },
      comisiones: {
        pendienteCents: Number(comisionesStats.find((r) => r.status === "PENDIENTE")?.montoCents ?? 0),
        comisionadaCents: Number(comisionesStats.find((r) => r.status === "COMISIONADA")?.montoCents ?? 0),
      },
      siniestros: {
        byStatus: siniestrosByStatus,
        valorTotalCents: siniestrosByStatus.reduce((sum, r) => sum + Number(r.valorCents ?? 0), 0),
      },
      monthly: {
        quotes: { total: quotesThisMonth.total, deltaPercent: monthOverMonth(quotesThisMonth.total, quotesLastMonth.total) },
        policiesEmitidas: {
          total: policiesThisMonth.total,
          deltaPercent: monthOverMonth(policiesThisMonth.total, policiesLastMonth.total),
        },
        renovacionesProximas30Dias: renovacionesProximas.total,
        comisionGeneradaCents: {
          total: Number(comisionThisMonth.total ?? 0),
          deltaPercent: monthOverMonth(Number(comisionThisMonth.total ?? 0), Number(comisionLastMonth.total ?? 0)),
        },
      },
    };
  },

  /** Producción por ejecutivo del mes (y ramo) — ver agent-report.ts. */
  async getAgentReport(tx: Db, organizationId: string, params: { month: ReportMonth; branch?: "AUTOS" | "SALUD" }) {
    const inMonth = and(
      eq(quotes.organizationId, organizationId),
      gte(quotes.createdAt, params.month.start),
      lt(quotes.createdAt, params.month.end),
      params.branch ? eq(quotes.branch, params.branch) : undefined,
    );

    const quoted = await tx
      .select({ agentId: quotes.agentId, quotes: countDistinct(quotes.id), risks: count(quoteRisks.id) })
      .from(quotes)
      .leftJoin(quoteRisks, eq(quoteRisks.quoteId, quotes.id))
      .where(inMonth)
      .groupBy(quotes.agentId);

    const issued = await tx
      .select({
        agentId: quotes.agentId,
        convertedQuotes: countDistinct(quotes.id),
        policies: count(policies.id),
        premiumCents: sum(policies.premiumCents),
      })
      .from(policies)
      .innerJoin(quoteOptions, eq(quoteOptions.id, policies.quoteOptionId))
      .innerJoin(quoteRisks, eq(quoteRisks.id, quoteOptions.quoteRiskId))
      .innerJoin(quotes, eq(quotes.id, quoteRisks.quoteId))
      .where(and(inMonth, eq(policies.isVoid, false)))
      .groupBy(quotes.agentId);

    const agentIds = quoted.map((r) => r.agentId);
    const agents = agentIds.length
      ? await tx.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, agentIds))
      : [];

    return buildAgentReport(
      quoted,
      issued.map((r) => ({ ...r, premiumCents: Number(r.premiumCents ?? 0) })),
      new Map(agents.map((a) => [a.id, a.fullName])),
    );
  },
};
