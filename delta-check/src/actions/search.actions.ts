"use server";

import { withOrganization } from "@/db";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { searchService } from "@/domains/search/services/search.service";

/**
 * Buscador del topbar (ítem 5 del feedback) — mismo criterio de scope que
 * `listMyAutoQuotes`/`listMyCommissions`: sin `quote:read_all` (AGENTE), la
 * búsqueda queda acotada a los propios clientes asignados; con ese permiso
 * (SUPERVISOR/ADMIN) busca en toda la organización.
 */
export async function searchClientsAndVehicles(query: string) {
  const session = await requirePermission("quote:read");
  const scopeToAgentId = session.permissions.has("quote:read_all") ? null : session.userId;

  return withOrganization(session.organizationId, (tx) =>
    searchService.search(tx, { organizationId: session.organizationId, query, scopeToAgentId }),
  );
}
