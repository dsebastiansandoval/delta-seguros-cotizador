import { and, eq, isNull, or } from "drizzle-orm";
import type { Db } from "@/db";
import { rateRules, rateTables } from "@/db/schema/catalog";

export type ApplicableRateRule = typeof rateRules.$inferSelect;

/**
 * Busca la regla de tasa vigente para un riesgo — equivalente al VLOOKUP de
 * INFO GENERAL!AF7:AI25 que hoy solo tienen Latina y Cóndor en el Excel
 * (EXCEL-AUDIT.md §2.1). Si no hay ninguna, la aseguradora queda en modo
 * "digitación manual" — no es un error, es el estado normal para las otras
 * 11 hasta que se les consiga una tabla real (ARCHITECTURE.md §11.1).
 */
export const rateRepository = {
  async findApplicableRule(
    tx: Db,
    params: {
      insurerId: string;
      bodyType: string;
      vehicleYear: number;
      insuredValueCents: number;
    },
  ): Promise<ApplicableRateRule | null> {
    const currentYear = new Date().getFullYear();
    const vehicleAge = currentYear - params.vehicleYear;

    const [table] = await tx
      .select()
      .from(rateTables)
      .where(and(eq(rateTables.insurerId, params.insurerId), eq(rateTables.isConfirmed, true)))
      .limit(1);
    if (!table) return null;

    const candidates = await tx
      .select()
      .from(rateRules)
      .where(
        and(
          eq(rateRules.rateTableId, table.id),
          or(isNull(rateRules.bodyType), eq(rateRules.bodyType, params.bodyType)),
        ),
      );

    const match = candidates.find((rule) => {
      const ageOk =
        (rule.vehicleAgeMin == null || vehicleAge >= rule.vehicleAgeMin) &&
        (rule.vehicleAgeMax == null || vehicleAge <= rule.vehicleAgeMax);
      const valueOk =
        (rule.valueMinCents == null || params.insuredValueCents >= rule.valueMinCents) &&
        (rule.valueMaxCents == null || params.insuredValueCents <= rule.valueMaxCents);
      return ageOk && valueOk;
    });

    return match ?? null;
  },
};
