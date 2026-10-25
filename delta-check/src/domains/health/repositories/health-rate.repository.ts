import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { healthRateRules, rateTables } from "@/db/schema/catalog";

export type HealthRateRule = typeof healthRateRules.$inferSelect;

/**
 * A diferencia de Autos (una regla por riesgo), acá se buscan TODAS las
 * reglas que apliquen a una persona — una por cada plan que ofrezca la
 * aseguradora (BMI: Sigma, Innova, GMM...) — para que el comparador pueda
 * mostrar cada plan como una opción separada. Ver EXCEL-AUDIT.md §2.3.
 */
export const healthRateRepository = {
  async findApplicableRules(
    tx: Db,
    params: { insurerId: string; age: number; gender: string; region: string; relation: string },
  ): Promise<HealthRateRule[]> {
    const [table] = await tx
      .select()
      .from(rateTables)
      .where(and(eq(rateTables.insurerId, params.insurerId), eq(rateTables.isConfirmed, true)))
      // Las tarifas cambian una vez al año: manda la tabla vigente más reciente.
      .orderBy(desc(rateTables.validFrom))
      .limit(1);
    if (!table) return [];

    const rules = await tx
      .select()
      .from(healthRateRules)
      .where(eq(healthRateRules.rateTableId, table.id));

    return rules.filter((rule) => {
      const ageOk = params.age >= rule.ageMin && params.age <= rule.ageMax;
      const genderOk = rule.gender == null || rule.gender === params.gender;
      const regionOk = rule.region == null || rule.region === params.region;
      const relationOk = rule.relation == null || rule.relation === params.relation;
      return ageOk && genderOk && regionOk && relationOk;
    });
  },
};
