import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { organizationSettings } from "@/db/schema/settings";
import { DEFAULT_ENGINE_RATES, type EngineRates } from "../offer/excel-rates";
import { ENGINE_RATES_SETTING_KEY, engineRatesSchema } from "../schemas/engine-rates.schema";

/**
 * Tablas de Latina y Cóndor de la organización (RLS filtra por tenant). Sin
 * fila guardada se usan las del Excel; una fila que ya no valida (cambió el
 * formato) también cae al default en vez de romper la cotización.
 */
export const engineRatesService = {
  async get(tx: Db): Promise<{ rates: EngineRates; customized: boolean; updatedAt: Date | null }> {
    const [row] = await tx
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.key, ENGINE_RATES_SETTING_KEY));
    const parsed = row ? engineRatesSchema.safeParse(row.value) : null;
    if (!parsed?.success) return { rates: DEFAULT_ENGINE_RATES, customized: false, updatedAt: null };
    return { rates: parsed.data, customized: true, updatedAt: row.updatedAt };
  },

  async save(tx: Db, organizationId: string, userId: string, rates: EngineRates) {
    await tx
      .insert(organizationSettings)
      .values({ organizationId, key: ENGINE_RATES_SETTING_KEY, value: rates, updatedBy: userId })
      .onConflictDoUpdate({
        target: [organizationSettings.organizationId, organizationSettings.key],
        set: { value: rates, updatedBy: userId, updatedAt: new Date() },
      });
  },

  /** Vuelve a las tablas del Excel. */
  async reset(tx: Db) {
    await tx.delete(organizationSettings).where(eq(organizationSettings.key, ENGINE_RATES_SETTING_KEY));
  },
};
