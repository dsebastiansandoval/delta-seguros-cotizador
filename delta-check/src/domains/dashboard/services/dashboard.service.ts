import { count, eq, sum } from "drizzle-orm";
import type { Db } from "@/db";
import { quotes } from "@/db/schema/quoting";
import { policies, commissions, claims } from "@/db/schema/policies";

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
        canceladas: policyStats.find((r) => r.lifecycleStatus === "CANCELADA")?.total ?? 0,
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
    };
  },
};
