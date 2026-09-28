import { and, desc, eq, inArray, or, ilike } from "drizzle-orm";
import type { Db } from "@/db";
import { clients, vehicles } from "@/db/schema/clients";
import { quotes } from "@/db/schema/quoting";
import { policies } from "@/db/schema/policies";

export type SearchResultClient = {
  clientId: string;
  displayName: string;
  documentNumber: string;
  matchedPlate: string | null;
  quotes: Array<{ id: string; code: string; branch: "AUTOS" | "SALUD"; status: string }>;
  policies: Array<{ id: string; policyNumber: string | null; lifecycleStatus: string }>;
};

/**
 * Buscador del topbar ("🔍 Buscar cliente o placa…", mockup visual +
 * feedback del usuario ítem 5) — todavía no hay una pantalla de "perfil de
 * cliente" propia (no se pidió, no se fabrica una), así que el resultado
 * es una lista de coincidencias con links directos a lo que sí existe:
 * sus cotizaciones y sus pólizas.
 */
export const searchService = {
  async search(
    tx: Db,
    params: { organizationId: string; query: string; scopeToAgentId: string | null },
  ): Promise<SearchResultClient[]> {
    const q = params.query.trim();
    if (!q) return [];

    const scopeFilter = params.scopeToAgentId ? eq(clients.assignedAgentId, params.scopeToAgentId) : undefined;

    // Coincidencia por datos del cliente (nombre, razón social, documento).
    const byClient = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(
        and(
          eq(clients.organizationId, params.organizationId),
          scopeFilter,
          or(
            ilike(clients.firstName, `%${q}%`),
            ilike(clients.lastName, `%${q}%`),
            ilike(clients.businessName, `%${q}%`),
            ilike(clients.documentNumber, `%${q}%`),
          ),
        ),
      );

    // Coincidencia por placa — el vehículo no tiene agentId propio, se
    // filtra por el cliente dueño (join) para respetar el mismo scope.
    const byPlate = await tx
      .select({ id: clients.id, plate: vehicles.plate })
      .from(vehicles)
      .innerJoin(clients, eq(clients.id, vehicles.clientId))
      .where(and(eq(vehicles.organizationId, params.organizationId), scopeFilter, ilike(vehicles.plate, `%${q}%`)));

    const plateByClientId = new Map(byPlate.map((r) => [r.id, r.plate]));
    const clientIds = [...new Set([...byClient.map((r) => r.id), ...byPlate.map((r) => r.id)])];
    if (clientIds.length === 0) return [];

    const clientRows = await tx.select().from(clients).where(inArray(clients.id, clientIds));
    const quoteRows = await tx
      .select({ id: quotes.id, code: quotes.code, branch: quotes.branch, status: quotes.status, clientId: quotes.clientId })
      .from(quotes)
      .where(inArray(quotes.clientId, clientIds))
      .orderBy(desc(quotes.createdAt));
    const policyRows = await tx
      .select({ id: policies.id, policyNumber: policies.policyNumber, lifecycleStatus: policies.lifecycleStatus, clientId: policies.clientId })
      .from(policies)
      .where(inArray(policies.clientId, clientIds));

    return clientRows.map((client) => ({
      clientId: client.id,
      displayName:
        client.personType === "JURIDICA"
          ? (client.businessName ?? "-")
          : `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "-",
      documentNumber: client.documentNumber,
      matchedPlate: plateByClientId.get(client.id) ?? null,
      quotes: quoteRows
        .filter((r) => r.clientId === client.id)
        .map((r) => ({ id: r.id, code: r.code, branch: r.branch, status: r.status })),
      policies: policyRows
        .filter((r) => r.clientId === client.id)
        .map((r) => ({ id: r.id, policyNumber: r.policyNumber, lifecycleStatus: r.lifecycleStatus })),
    }));
  },
};
