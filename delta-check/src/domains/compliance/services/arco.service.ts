import { desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { arcoRequests } from "@/db/schema/compliance";
import { clients, insuredGroups, insuredMembers, vehicles } from "@/db/schema/clients";
import { quotes, quoteRisks, quoteOptions } from "@/db/schema/quoting";
import { claims, policies } from "@/db/schema/policies";
import { consents } from "@/db/schema/compliance";

/**
 * ARCO — Acceso/Rectificación/Cancelación/Oposición (ARCHITECTURE.md §14,
 * LOPDP Ecuador). No hay equivalente en el Excel — esto no es un dato de
 * negocio del cotizador, es cumplimiento legal, diseño propio.
 */
export const arcoService = {
  async createRequest(
    tx: Db,
    params: {
      organizationId: string;
      clientId: string;
      type: "ACCESO" | "RECTIFICACION" | "CANCELACION" | "OPOSICION";
      channel?: string;
      notes?: string;
      requestedByUserId: string;
    },
  ) {
    const [request] = await tx
      .insert(arcoRequests)
      .values({
        organizationId: params.organizationId,
        clientId: params.clientId,
        type: params.type,
        channel: params.channel,
        notes: params.notes,
        requestedByUserId: params.requestedByUserId,
      })
      .returning();
    return request;
  },

  async list(tx: Db) {
    return tx
      .select({
        id: arcoRequests.id,
        type: arcoRequests.type,
        status: arcoRequests.status,
        requestedAt: arcoRequests.requestedAt,
        clientId: arcoRequests.clientId,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientBusinessName: clients.businessName,
        clientDocumentNumber: clients.documentNumber,
      })
      .from(arcoRequests)
      .innerJoin(clients, eq(clients.id, arcoRequests.clientId))
      .orderBy(desc(arcoRequests.requestedAt));
  },

  async getDetail(tx: Db, requestId: string) {
    const [row] = await tx
      .select({ request: arcoRequests, client: clients })
      .from(arcoRequests)
      .innerJoin(clients, eq(clients.id, arcoRequests.clientId))
      .where(eq(arcoRequests.id, requestId));
    return row ?? null;
  },

  async updateStatus(
    tx: Db,
    requestId: string,
    params: { status: "EN_PROCESO" | "COMPLETADA" | "RECHAZADA"; resolutionNotes?: string; resolvedByUserId: string },
  ) {
    const [updated] = await tx
      .update(arcoRequests)
      .set({
        status: params.status,
        resolutionNotes: params.resolutionNotes,
        resolvedByUserId: params.resolvedByUserId,
        resolvedAt: params.status === "COMPLETADA" || params.status === "RECHAZADA" ? new Date() : undefined,
      })
      .where(eq(arcoRequests.id, requestId))
      .returning();
    return updated;
  },

  /**
   * Acceso — todo lo que el sistema tiene sobre este cliente, tal cual está
   * almacenado. Sin transformar ni resumir: el titular tiene derecho a ver
   * el dato crudo.
   */
  async exportClientData(tx: Db, clientId: string) {
    const [client] = await tx.select().from(clients).where(eq(clients.id, clientId));
    if (!client) return null;

    const clientVehicles = await tx.select().from(vehicles).where(eq(vehicles.clientId, clientId));
    const groups = await tx.select().from(insuredGroups).where(eq(insuredGroups.clientId, clientId));
    const groupIds = groups.map((g) => g.id);
    const members = groupIds.length
      ? await tx.select().from(insuredMembers).where(inArray(insuredMembers.groupId, groupIds))
      : [];

    const clientQuotes = await tx.select().from(quotes).where(eq(quotes.clientId, clientId));
    const quoteIds = clientQuotes.map((q) => q.id);
    const risks = quoteIds.length
      ? await tx.select().from(quoteRisks).where(inArray(quoteRisks.quoteId, quoteIds))
      : [];
    const riskIds = risks.map((r) => r.id);
    const options = riskIds.length
      ? await tx.select().from(quoteOptions).where(inArray(quoteOptions.quoteRiskId, riskIds))
      : [];

    const clientPolicies = await tx.select().from(policies).where(eq(policies.clientId, clientId));
    const policyIds = clientPolicies.map((p) => p.id);
    const clientClaims = policyIds.length
      ? await tx.select().from(claims).where(inArray(claims.policyId, policyIds))
      : [];

    const clientConsents = await tx.select().from(consents).where(eq(consents.clientId, clientId));

    return {
      client,
      vehicles: clientVehicles,
      insuredGroups: groups,
      insuredMembers: members,
      quotes: clientQuotes,
      quoteRisks: risks,
      quoteOptions: options,
      policies: clientPolicies,
      claims: clientClaims,
      consents: clientConsents,
      exportedAt: new Date().toISOString(),
    };
  },

  /** Rectificación — corrige datos básicos del titular. */
  async rectifyClient(
    tx: Db,
    clientId: string,
    updates: { firstName?: string; lastName?: string; businessName?: string; email?: string; phone?: string },
  ) {
    const [updated] = await tx
      .update(clients)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(clients.id, clientId))
      .returning();
    return updated;
  },

  /**
   * Cancelación — nunca borra la fila (pólizas/siniestros/comisiones ligados
   * exigen retención legal, y el propio LOPDP exceptúa el borrado cuando hay
   * una obligación legal de conservar el dato — ARCHITECTURE.md §14). Lo que
   * sí se hace siempre: redactar contacto (email/teléfono), que no hace
   * falta para administrar una póliza ya emitida. El nombre solo se redacta
   * si el cliente nunca tuvo una póliza — si tuvo alguna (vigente o no),
   * queda como identificación legal del asegurado en el historial.
   */
  async anonymizeClient(tx: Db, clientId: string) {
    const clientPolicies = await tx.select().from(policies).where(eq(policies.clientId, clientId));
    const hasAnyPolicy = clientPolicies.length > 0;

    const [updated] = await tx
      .update(clients)
      .set({
        email: "[ANONIMIZADO]",
        phone: "[ANONIMIZADO]",
        ...(hasAnyPolicy
          ? {}
          : { firstName: "[ANONIMIZADO]", lastName: "[ANONIMIZADO]", businessName: "[ANONIMIZADO]" }),
        isAnonymized: true,
        anonymizedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId))
      .returning();

    return { client: updated, fullyAnonymized: !hasAnyPolicy, retainedForPolicyHistory: hasAnyPolicy };
  },

  /** Oposición — no hay pipeline de marketing automatizado en la app todavía; esto deja el flag para cuando lo haya. */
  async setMarketingOptOut(tx: Db, clientId: string, optOut: boolean) {
    const [updated] = await tx
      .update(clients)
      .set({ marketingOptOut: optOut, updatedAt: new Date() })
      .where(eq(clients.id, clientId))
      .returning();
    return updated;
  },
};
