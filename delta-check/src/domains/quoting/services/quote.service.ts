import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { quoteRisks, quotes } from "@/db/schema/quoting";
import { clients, vehicles } from "@/db/schema/clients";
import { nextQuoteCode } from "./quote-code.service";

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
      previousStartDate?: string;
      previousPremiumCents?: number;
    },
  ) {
    const [quote] = await tx
      .insert(quotes)
      .values({
        organizationId: params.organizationId,
        code: await nextQuoteCode(tx, params.organizationId),
        clientId: params.clientId,
        agentId: params.agentId,
        branch: "AUTOS",
        operationType: params.operationType,
        status: "BORRADOR",
        modality: params.modality,
        previousInsurerId: params.previousInsurerId,
        previousPolicyNumber: params.previousPolicyNumber,
        previousExpiryDate: params.previousExpiryDate,
        previousStartDate: params.previousStartDate,
        previousPremiumCents: params.previousPremiumCents,
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

  /** Cliente + vehículo(s) de una cotización, para precargar el formulario de edición. */
  async getEditData(tx: Db, quoteId: string) {
    const quote = await quoteService.findById(tx, quoteId);
    if (!quote) return null;

    const [client] = await tx.select().from(clients).where(eq(clients.id, quote.clientId)).limit(1);
    if (!client) return null;

    const risks = await quoteService.findRisksByQuote(tx, quoteId);
    const vehicleIds = risks.map((r) => r.vehicleId).filter((id): id is string => Boolean(id));
    const vehicleRows = vehicleIds.length ? await tx.select().from(vehicles).where(inArray(vehicles.id, vehicleIds)) : [];
    const vehicleById = new Map(vehicleRows.map((v) => [v.id, v]));

    return {
      quote,
      client,
      risks: risks.map((r) => ({ ...r, vehicle: r.vehicleId ? (vehicleById.get(r.vehicleId) ?? null) : null })),
    };
  },

  /**
   * Corrige una cotización BORRADOR ya creada (ver updateAutoQuote en
   * quote.actions.ts) — cliente y número de riesgos no cambian acá, solo
   * sus valores. `risks` viene ya emparejado 1 a 1 por posición con los
   * `quote_risks` existentes (mismo orden, mismo riskNumber).
   */
  async updateAutoQuote(
    tx: Db,
    quoteId: string,
    params: {
      clientId: string;
      modality: "ANUAL" | "POR_KM";
      operationType: "NUEVA" | "RENOVACION";
      previousInsurerId?: string;
      previousPolicyNumber?: string;
      previousStartDate?: string;
      previousExpiryDate?: string;
      previousPremiumCents?: number;
      risks: Array<{ quoteRiskId: string; insuredValueCents: number; extrasValueCents: number }>;
    },
  ) {
    const isRenewal = params.operationType === "RENOVACION";
    await tx
      .update(quotes)
      .set({
        clientId: params.clientId,
        modality: params.modality,
        operationType: params.operationType,
        previousInsurerId: isRenewal ? params.previousInsurerId : null,
        previousPolicyNumber: isRenewal ? params.previousPolicyNumber : null,
        previousStartDate: isRenewal ? params.previousStartDate : null,
        previousExpiryDate: isRenewal ? params.previousExpiryDate : null,
        previousPremiumCents: isRenewal ? params.previousPremiumCents : null,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, quoteId));

    for (const r of params.risks) {
      await tx
        .update(quoteRisks)
        .set({ insuredValueCents: r.insuredValueCents, extrasValueCents: r.extrasValueCents })
        .where(eq(quoteRisks.id, r.quoteRiskId));
    }
  },

  /**
   * BORRADOR → ENVIADA la primera vez que se descarga la oferta en PDF (rutas
   * `caratula`/`caratula-am`) — es la señal real de "se le envió la cotización
   * al cliente". dashboard.service.ts ya asumía este estado para contar
   * producción por ejecutivo (`ne(quotes.status, "BORRADOR")`), pero nada lo
   * escribía todavía. No-op si ya salió de BORRADOR (no retrocede ENVIADA/
   * ACEPTADA/VENCIDA).
   */
  async markSent(tx: Db, quoteId: string) {
    await tx
      .update(quotes)
      .set({ status: "ENVIADA", updatedAt: new Date() })
      .where(and(eq(quotes.id, quoteId), eq(quotes.status, "BORRADOR")));
  },

  /** ENVIADA/BORRADOR → ACEPTADA al emitir una póliza desde una opción de esta cotización. */
  async markAccepted(tx: Db, quoteId: string) {
    await tx
      .update(quotes)
      .set({ status: "ACEPTADA", updatedAt: new Date() })
      .where(and(eq(quotes.id, quoteId), inArray(quotes.status, ["BORRADOR", "ENVIADA"])));
  },
};
