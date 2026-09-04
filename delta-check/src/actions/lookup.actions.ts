"use server";

import { withOrganization } from "@/db";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { SriCedulaLookupAdapter } from "@/domains/lookup/gateways/sri-cedula-lookup.adapter";
import type { PersonLookupResult } from "@/domains/lookup/gateways/cedula-lookup.gateway";
import { audit } from "@/domains/shared/audit";
import { rateLimit } from "@/lib/rate-limit";

const gateway = new SriCedulaLookupAdapter();

/**
 * Autocompletar nombres desde la cédula (SRI) — botón "Buscar" en el
 * formulario de nueva cotización. Nunca bloquea el flujo: cualquier
 * resultado que no sea FOUND deja los campos para digitación manual, igual
 * que cualquier otro dato sin fuente real en este proyecto. Se audita
 * porque es una consulta de identidad de un tercero (ARCHITECTURE.md §9,
 * client:read_pii — mismo permiso que ver la cédula/nombre del cliente).
 */
export async function lookupPersonByCedula(documentNumber: string): Promise<PersonLookupResult> {
  const session = await requirePermission("client:read_pii");
  await rateLimit(`lookup:${session.userId}`, { limit: 20, window: "1 m" });

  const result = await gateway.lookupPerson(documentNumber);

  if (result.status === "FOUND") {
    await withOrganization(session.organizationId, (tx) =>
      audit(tx, {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "cedula.lookup",
        entityType: "external:sri",
        metadata: { documentNumber },
      }),
    );
  }

  return result;
}
