import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { quoteCodeSequences } from "@/db/schema/quoting";

/**
 * Correlativo visible real de `quotes.code` (COT-2026-00184...), por
 * organización y año — cierra el TODO(Fase 1) que antes dejaba un sufijo
 * aleatorio a propósito (ARCHITECTURE.md §12). UPSERT atómico sobre
 * `quote_code_sequences`: dos cotizaciones creadas al mismo tiempo en la
 * misma organización nunca repiten número, sin necesitar un
 * `SELECT ... FOR UPDATE` aparte. Compartido entre Autos y Salud — antes
 * cada uno tenía su propia copia del mismo placeholder.
 */
export async function nextQuoteCode(tx: Db, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = await tx
    .insert(quoteCodeSequences)
    .values({ organizationId, year, lastValue: 1 })
    .onConflictDoUpdate({
      target: [quoteCodeSequences.organizationId, quoteCodeSequences.year],
      set: { lastValue: sql`${quoteCodeSequences.lastValue} + 1` },
    })
    .returning({ lastValue: quoteCodeSequences.lastValue });

  return `COT-${year}-${row.lastValue.toString().padStart(5, "0")}`;
}
