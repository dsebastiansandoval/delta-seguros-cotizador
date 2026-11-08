"use server";

import { withOrganization } from "@/db";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { SriCedulaLookupAdapter } from "@/domains/lookup/gateways/sri-cedula-lookup.adapter";
import { WebServicesEcCedulaLookupAdapter } from "@/domains/lookup/gateways/webservices-ec-cedula-lookup.adapter";
import { EcuadorApiPlateLookupAdapter } from "@/domains/lookup/gateways/ecuadorapi-plate-lookup.adapter";
import type { DocumentLookupResult } from "@/domains/lookup/gateways/cedula-lookup.gateway";
import type { VehiclePlateLookupResult } from "@/domains/lookup/gateways/vehicle-plate-lookup.gateway";
import { audit } from "@/domains/shared/audit";
import { rateLimit } from "@/lib/rate-limit";

const documentGateway = new SriCedulaLookupAdapter();
const documentFallbackGateway = new WebServicesEcCedulaLookupAdapter();
const plateGateway = new EcuadorApiPlateLookupAdapter();

/**
 * Autocompletar nombres/razón social desde cédula o RUC — primero el SRI
 * (gratis), y solo si NOT_FOUND se encadena WebServices.ec (pago,
 * $0.05/cédula) como respaldo. El SRI solo tiene RUC de persona natural si
 * está registrada como contribuyente — un empleado común no sale ahí, por
 * eso hace falta el respaldo (ver Workstream B del plan de la reunión
 * 6-nov). Nunca en paralelo, para no gastar la consulta paga cuando el SRI
 * ya resolvió. Dispara solo al perder foco el campo "Documento" (ver
 * `useDocumentLookup.ts`), nunca bloquea el flujo: cualquier resultado que
 * no sea FOUND deja los campos para digitación manual. Se audita porque es
 * una consulta de identidad de un tercero (ARCHITECTURE.md §9,
 * client:read_pii — mismo permiso que ver la cédula/nombre del cliente).
 */
export async function lookupPersonByDocument(
  documentNumber: string,
  documentType: "CEDULA" | "RUC",
): Promise<DocumentLookupResult> {
  const session = await requirePermission("client:read_pii");
  await rateLimit(`lookup:${session.userId}`, { limit: 20, window: "1 m" });

  let result =
    documentType === "CEDULA" ? await documentGateway.lookupByCedula(documentNumber) : await documentGateway.lookupByRuc(documentNumber);
  let source = "external:sri";

  if (result.status === "NOT_FOUND") {
    result =
      documentType === "CEDULA"
        ? await documentFallbackGateway.lookupByCedula(documentNumber)
        : await documentFallbackGateway.lookupByRuc(documentNumber);
    source = "external:webservices_ec";
  }

  if (result.status === "FOUND") {
    await withOrganization(session.organizationId, (tx) =>
      audit(tx, {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "document.lookup",
        entityType: source,
        metadata: { documentNumber, documentType },
      }),
    );
  }

  return result;
}

/**
 * Autocompletar marca/modelo/año/color del vehículo desde la placa
 * (EcuadorAPI, consulta paga) — dispara al perder foco el campo "Placa"
 * (ver `usePlateLookup.ts`). No es PII de cliente, así que el permiso es
 * el mismo que crear una cotización, no `client:read_pii`.
 */
export async function lookupVehicleByPlate(plate: string): Promise<VehiclePlateLookupResult> {
  const session = await requirePermission("quote:create");
  await rateLimit(`lookup:${session.userId}`, { limit: 20, window: "1 m" });

  const result = await plateGateway.lookupPlate(plate);

  if (result.status === "FOUND") {
    await withOrganization(session.organizationId, (tx) =>
      audit(tx, {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "vehicle.plate_lookup",
        entityType: "external:ecuadorapi",
        metadata: { plate },
      }),
    );
  }

  return result;
}
