import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { healthRateRules, insurers, rateTables } from "@/db/schema/catalog";
import { HEALTH_PLANS } from "../health-plans.generated";
import type { HealthRateCsvRow } from "./health-rate-csv";

const BATCH = 1000;

/** Fecha de hoy en Ecuador (UTC-5) — a las 20:00 locales UTC ya es mañana. */
export function todayInEcuador() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date());
}

/** Planes con tabla de esa aseguradora (los `manual` se digitan en la cotización, no se cargan). */
export function ratedPlanCodes(insurerCode: string) {
  return HEALTH_PLANS.filter((p) => p.insurerCode === insurerCode && !p.manual).map((p) => p.planCode);
}

/**
 * Carga de tarifas de Salud desde /admin/tarifas-salud — reemplaza a
 * `npm run db:seed:salud` para las actualizaciones anuales. Cada carga es
 * una tabla nueva con su `validFrom`; las anteriores quedan como historial
 * (la cotización ya guardó su prima, no depende de la tabla). Cotiza la de
 * `validFrom` más reciente que ya empezó, así que se puede cargar antes la
 * tarifa del año que viene.
 */
export const healthRateAdminService = {
  async overview(tx: Db) {
    const healthInsurers = await tx.select().from(insurers).where(eq(insurers.branch, "SALUD")).orderBy(asc(insurers.name));
    const tables = await tx
      .select({
        id: rateTables.id,
        insurerId: rateTables.insurerId,
        validFrom: rateTables.validFrom,
        rules: count(healthRateRules.id),
        plans: sql<string[]>`coalesce(array_agg(distinct ${healthRateRules.planCode}) filter (where ${healthRateRules.planCode} is not null), '{}')`,
      })
      .from(rateTables)
      .leftJoin(healthRateRules, eq(healthRateRules.rateTableId, rateTables.id))
      .where(and(eq(rateTables.branch, "SALUD"), eq(rateTables.isConfirmed, true)))
      .groupBy(rateTables.id)
      .orderBy(desc(rateTables.validFrom));

    const today = todayInEcuador();
    return healthInsurers.map((insurer) => {
      const own = tables.filter((t) => t.insurerId === insurer.id);
      const current = own.find((t) => t.validFrom <= today) ?? null;
      return {
        id: insurer.id,
        code: insurer.code,
        name: insurer.name,
        ratedPlanCodes: ratedPlanCodes(insurer.code),
        current,
        scheduled: own.filter((t) => t.validFrom > today),
        history: own.filter((t) => t.validFrom <= today && t !== current),
      };
    });
  },

  async findTable(tx: Db, tableId: string) {
    const [table] = await tx
      .select({ id: rateTables.id, validFrom: rateTables.validFrom, insurerCode: insurers.code })
      .from(rateTables)
      .innerJoin(insurers, eq(insurers.id, rateTables.insurerId))
      .where(and(eq(rateTables.id, tableId), eq(rateTables.branch, "SALUD")));
    if (!table) return null;
    const rules = await tx
      .select({
        planCode: healthRateRules.planCode,
        relation: healthRateRules.relation,
        ageMin: healthRateRules.ageMin,
        ageMax: healthRateRules.ageMax,
        gender: healthRateRules.gender,
        region: healthRateRules.region,
        premiumCents: healthRateRules.premiumCents,
      })
      .from(healthRateRules)
      .where(eq(healthRateRules.rateTableId, tableId))
      .orderBy(asc(healthRateRules.planCode), asc(healthRateRules.relation), asc(healthRateRules.region), asc(healthRateRules.gender), asc(healthRateRules.ageMin));
    return { ...table, rules };
  },

  /** Una sola tabla por aseguradora y fecha: volver a cargar la misma fecha la reemplaza. */
  async replace(
    tx: Db,
    organizationId: string,
    userId: string,
    input: { insurerId: string; validFrom: string; rows: HealthRateCsvRow[] },
  ) {
    const sameDate = await tx
      .select({ id: rateTables.id })
      .from(rateTables)
      .where(and(eq(rateTables.insurerId, input.insurerId), eq(rateTables.branch, "SALUD"), eq(rateTables.validFrom, input.validFrom)));
    if (sameDate.length) {
      const ids = sameDate.map((t) => t.id);
      await tx.delete(healthRateRules).where(inArray(healthRateRules.rateTableId, ids));
      await tx.delete(rateTables).where(inArray(rateTables.id, ids));
    }

    const [table] = await tx
      .insert(rateTables)
      .values({
        organizationId,
        insurerId: input.insurerId,
        branch: "SALUD",
        visibility: "PRIVATE",
        isConfirmed: true,
        validFrom: input.validFrom,
        createdBy: userId,
      })
      .returning();

    const values = input.rows.map((row) => ({ rateTableId: table.id, ...row }));
    for (let i = 0; i < values.length; i += BATCH) {
      await tx.insert(healthRateRules).values(values.slice(i, i + BATCH));
    }
    return { tableId: table.id, replaced: sameDate.length > 0 };
  },
};
