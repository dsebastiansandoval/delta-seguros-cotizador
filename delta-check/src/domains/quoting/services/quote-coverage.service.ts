import { asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { coverages, insurers } from "@/db/schema/catalog";
import { quoteOptionCoverages, quoteOptions, quoteRisks, quotes } from "@/db/schema/quoting";
import { vehicles } from "@/db/schema/clients";

export type CoverageRow = {
  coverageId: string;
  code: string;
  name: string;
  valueType: "BOOLEAN" | "AMOUNT" | "TEXT";
  granted: boolean;
  amountCents: number | null;
  textValue: string | null;
};

export type QuoteOptionContext = {
  quoteId: string;
  quoteCode: string;
  insurerName: string;
  /** Solo Autos — undefined en Salud (el riesgo no tiene vehículo, usa insuredGroupId). */
  vehicleLabel?: string;
  planCode?: string;
  branch: "AUTOS" | "SALUD";
};

/**
 * Grilla "Sí otorga"/montos por aseguradora (ítem 8 del feedback del
 * usuario — la mitad de "tabla realízala" que no se cubrió en la primera
 * pasada, ARCHITECTURE.md §26/§29). `quote_option_coverages` es un dato
 * MANUAL que llega de cada aseguradora por cotización — nunca se fabrica
 * un "Sí otorga" sin que el ejecutivo lo haya confirmado; por eso el LEFT
 * JOIN trae las 18 coberturas reales con `granted: false` por default
 * cuando todavía no se cargó nada, en vez de omitirlas.
 */
export const quoteCoverageService = {
  async getContext(tx: Db, quoteOptionId: string): Promise<QuoteOptionContext | null> {
    const [row] = await tx
      .select({
        quoteId: quotes.id,
        quoteCode: quotes.code,
        insurerName: insurers.name,
        branch: quotes.branch,
        planCode: quoteOptions.planCode,
        brand: vehicles.brand,
        model: vehicles.model,
        year: vehicles.year,
      })
      .from(quoteOptions)
      .innerJoin(insurers, eq(insurers.id, quoteOptions.insurerId))
      .innerJoin(quoteRisks, eq(quoteRisks.id, quoteOptions.quoteRiskId))
      .innerJoin(quotes, eq(quotes.id, quoteRisks.quoteId))
      // LEFT JOIN — en Salud el riesgo no tiene vehículo (usa insuredGroupId
      // en cambio, vehicleId queda null); un INNER JOIN acá descartaba la
      // fila entera y la página de coberturas de Salud siempre daba 404.
      .leftJoin(vehicles, eq(vehicles.id, quoteRisks.vehicleId))
      .where(eq(quoteOptions.id, quoteOptionId))
      .limit(1);
    if (!row) return null;
    return {
      quoteId: row.quoteId,
      quoteCode: row.quoteCode,
      insurerName: row.insurerName,
      branch: row.branch,
      planCode: row.planCode ?? undefined,
      vehicleLabel: row.brand ? `${row.brand} ${row.model} ${row.year}` : undefined,
    };
  },

  async listForOption(tx: Db, quoteOptionId: string, branch: "AUTOS" | "SALUD"): Promise<CoverageRow[]> {
    const catalog = await tx
      .select()
      .from(coverages)
      .where(eq(coverages.branch, branch))
      .orderBy(asc(coverages.displayOrder));

    const existing = await tx
      .select()
      .from(quoteOptionCoverages)
      .where(eq(quoteOptionCoverages.quoteOptionId, quoteOptionId));
    const byCoverageId = new Map(existing.map((r) => [r.coverageId, r]));

    return catalog.map((c) => {
      const saved = byCoverageId.get(c.id);
      return {
        coverageId: c.id,
        code: c.code,
        name: c.name,
        valueType: c.valueType,
        granted: saved?.granted ?? false,
        amountCents: saved?.amountCents ?? null,
        textValue: saved?.textValue ?? null,
      };
    });
  },

  /**
   * Upsert de las 18 filas — no un INSERT ciego, para poder corregir un
   * dato mal digitado antes de emitir (mismo criterio que
   * `comparisonService.setManualPremium`, que también permite corregir la
   * prima manual ya guardada). El índice único `(quote_option_id,
   * coverage_id)` es lo que hace el upsert seguro sin duplicar filas.
   */
  async saveForOption(
    tx: Db,
    organizationId: string,
    quoteOptionId: string,
    entries: Array<{ coverageId: string; granted: boolean; amountCents: number | null; textValue: string | null }>,
  ) {
    for (const entry of entries) {
      await tx
        .insert(quoteOptionCoverages)
        .values({
          organizationId,
          quoteOptionId,
          coverageId: entry.coverageId,
          granted: entry.granted,
          amountCents: entry.amountCents,
          textValue: entry.textValue,
        })
        .onConflictDoUpdate({
          target: [quoteOptionCoverages.quoteOptionId, quoteOptionCoverages.coverageId],
          set: { granted: entry.granted, amountCents: entry.amountCents, textValue: entry.textValue },
        });
    }
  },
};
