import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { quoteRisks, quotes } from "@/db/schema/quoting";

/** Correlativo visible tipo COT-2026-00184 (ARCHITECTURE.md §4.2). */
function generateQuoteCode(): string {
  const year = new Date().getFullYear();
  const suffix = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");
  // TODO(Fase 1): correlativo real por organización (secuencia en BD), esto
  // es aleatorio a propósito para no fingir una garantía de unicidad que no
  // tiene todavía — ver ARCHITECTURE.md §12 "Definition of done por fase".
  return `COT-${year}-${suffix}`;
}

export const quoteService = {
  async createAutoQuote(
    tx: Db,
    params: {
      organizationId: string;
      agentId: string;
      clientId: string;
      vehicleId: string;
      insuredValueCents: number;
      extrasValueCents: number;
      operationType: "NUEVA" | "RENOVACION";
    },
  ) {
    const [quote] = await tx
      .insert(quotes)
      .values({
        organizationId: params.organizationId,
        code: generateQuoteCode(),
        clientId: params.clientId,
        agentId: params.agentId,
        branch: "AUTOS",
        operationType: params.operationType,
        status: "BORRADOR",
      })
      .returning();

    const [risk] = await tx
      .insert(quoteRisks)
      .values({
        organizationId: params.organizationId,
        quoteId: quote.id,
        riskNumber: 1,
        vehicleId: params.vehicleId,
        insuredValueCents: params.insuredValueCents,
        extrasValueCents: params.extrasValueCents,
      })
      .returning();

    return { quote, risk };
  },

  async findById(tx: Db, quoteId: string) {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
    return quote ?? null;
  },
};
