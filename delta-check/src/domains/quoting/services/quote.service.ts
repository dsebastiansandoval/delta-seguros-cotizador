import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { paymentOptions, quoteInsurerSettings, quoteOptionCoverages, quoteOptions, quoteRisks, quotes } from "@/db/schema/quoting";
import { clients, vehicles } from "@/db/schema/clients";
import { policies } from "@/db/schema/policies";
import { nextQuoteCode } from "./quote-code.service";

export class QuoteDeleteError extends Error {}

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
   * Agrega UN riesgo a una cotización BORRADOR ya creada — "agregar
   * riesgo" al editar (ver updateAutoQuote en quote.actions.ts). El
   * vehículo ya viene creado (clientService.editClientAndVehicles); acá
   * solo se arma la fila de `quote_risks` que lo conecta con la cotización.
   */
  async addRisk(
    tx: Db,
    params: { organizationId: string; quoteId: string; riskNumber: number; vehicleId: string; insuredValueCents: number; extrasValueCents: number },
  ) {
    const [risk] = await tx
      .insert(quoteRisks)
      .values({
        organizationId: params.organizationId,
        quoteId: params.quoteId,
        riskNumber: params.riskNumber,
        vehicleId: params.vehicleId,
        insuredValueCents: params.insuredValueCents,
        extrasValueCents: params.extrasValueCents,
      })
      .returning();
    return risk;
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

  /**
   * Borra UN riesgo sobrante al editar (se redujo el número de vehículos,
   * ver updateAutoQuote en quote.actions.ts) — mismo criterio y mismo
   * guard de póliza que deleteQuote, pero acotado a un solo `quote_risk`
   * en vez de toda la cotización. Nunca borra el vehículo (vehicles.ts):
   * es del cliente, no del riesgo.
   */
  async deleteRisk(tx: Db, riskId: string) {
    const options = await tx.select({ id: quoteOptions.id }).from(quoteOptions).where(eq(quoteOptions.quoteRiskId, riskId));
    const optionIds = options.map((o) => o.id);

    if (optionIds.length) {
      const [linkedPolicy] = await tx
        .select({ id: policies.id })
        .from(policies)
        .where(inArray(policies.quoteOptionId, optionIds))
        .limit(1);
      if (linkedPolicy) {
        throw new QuoteDeleteError("Uno de los vehículos que quitaste ya tiene una póliza emitida — no se puede editar así.");
      }

      await tx.delete(quoteOptionCoverages).where(inArray(quoteOptionCoverages.quoteOptionId, optionIds));
      await tx.delete(paymentOptions).where(inArray(paymentOptions.quoteOptionId, optionIds));
      await tx.delete(quoteOptions).where(inArray(quoteOptions.id, optionIds));
    }

    await tx.delete(quoteRisks).where(eq(quoteRisks.id, riskId));
  },

  /**
   * Borra una cotización entera (Autos o Salud, misma tabla) — "Eliminar"
   * en Mis cotizaciones, solo ADMIN/SUPERVISOR (quote.actions.ts). Nunca
   * borra el cliente ni el vehículo/grupo asegurado: son del cliente, no
   * de la cotización, y pueden estar en uso de otra (renovación, otro
   * riesgo). Bloqueada si ya salió una póliza de alguna de sus opciones —
   * ahí ya no es "una cotización que sobra", es un contrato real.
   */
  async deleteQuote(tx: Db, quoteId: string) {
    const risks = await tx.select({ id: quoteRisks.id }).from(quoteRisks).where(eq(quoteRisks.quoteId, quoteId));
    const riskIds = risks.map((r) => r.id);

    const options = riskIds.length
      ? await tx.select({ id: quoteOptions.id }).from(quoteOptions).where(inArray(quoteOptions.quoteRiskId, riskIds))
      : [];
    const optionIds = options.map((o) => o.id);

    if (optionIds.length) {
      const [linkedPolicy] = await tx
        .select({ id: policies.id })
        .from(policies)
        .where(inArray(policies.quoteOptionId, optionIds))
        .limit(1);
      if (linkedPolicy) {
        throw new QuoteDeleteError("Esta cotización ya tiene una póliza emitida — no se puede eliminar.");
      }

      await tx.delete(quoteOptionCoverages).where(inArray(quoteOptionCoverages.quoteOptionId, optionIds));
      await tx.delete(paymentOptions).where(inArray(paymentOptions.quoteOptionId, optionIds));
      await tx.delete(quoteOptions).where(inArray(quoteOptions.id, optionIds));
    }

    await tx.delete(quoteInsurerSettings).where(eq(quoteInsurerSettings.quoteId, quoteId));
    await tx.delete(quoteRisks).where(eq(quoteRisks.quoteId, quoteId));
    await tx.delete(quotes).where(eq(quotes.id, quoteId));
  },
};
