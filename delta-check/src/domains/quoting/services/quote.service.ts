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
  /**
   * `risks` trae 1 a 4 entradas — Riesgo 1..4 del Excel (EXCEL-AUDIT.md §5).
   * Cada una se guarda como su propia fila en `quote_risks` con
   * `riskNumber` 1-indexado en el orden recibido — el comparador
   * (`comparisonService.runComparisonForRisk`) corre una vez por cada
   * riesgo, nunca junto.
   */
  async createAutoQuote(
    tx: Db,
    params: {
      organizationId: string;
      agentId: string;
      clientId: string;
      risks: Array<{ vehicleId: string; insuredValueCents: number; extrasValueCents: number }>;
      modality: "ANUAL" | "POR_KM";
      operationType: "NUEVA" | "RENOVACION";
      // Solo RENOVACION — traídos de la póliza/cotización anterior del
      // mismo vehículo (EXCEL-AUDIT.md §5, macro BUSCAR_BASE_VEHICULOS:
      // CIA ANTERIOR, No. POLIZA, FIN VIGENCIA).
      previousInsurerId?: string;
      previousPolicyNumber?: string;
      previousExpiryDate?: string;
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
        modality: params.modality,
        previousInsurerId: params.previousInsurerId,
        previousPolicyNumber: params.previousPolicyNumber,
        previousExpiryDate: params.previousExpiryDate,
      })
      .returning();

    const risks = [];
    for (let i = 0; i < params.risks.length; i++) {
      const r = params.risks[i];
      const [risk] = await tx
        .insert(quoteRisks)
        .values({
          organizationId: params.organizationId,
          quoteId: quote.id,
          riskNumber: i + 1,
          vehicleId: r.vehicleId,
          insuredValueCents: r.insuredValueCents,
          extrasValueCents: r.extrasValueCents,
        })
        .returning();
      risks.push(risk);
    }

    return { quote, risks };
  },

  async findById(tx: Db, quoteId: string) {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
    return quote ?? null;
  },

  async findRisksByQuote(tx: Db, quoteId: string) {
    return tx.select().from(quoteRisks).where(eq(quoteRisks.quoteId, quoteId)).orderBy(quoteRisks.riskNumber);
  },
};
