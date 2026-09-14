"use server";

import { withOrganization } from "@/db";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { renewalService } from "@/domains/clients/services/renewal.service";
import { audit } from "@/domains/shared/audit";

export type RenewalLookupResult =
  | { status: "NOT_FOUND" }
  | { status: "NO_VEHICLE"; clientFirstName: string | null; clientLastName: string | null }
  | {
      status: "FOUND";
      vehicle: {
        plate: string;
        brand: string;
        model: string;
        year: number;
        bodyType: string;
        color: string | null;
        commercialValueCents: number;
        extrasValueCents: number;
        hasTracker: boolean;
        city: string | null;
        province: string | null;
      };
      previousInsurerId: string | null;
      previousInsurerName: string | null;
      previousPolicyNumber: string | null;
      previousExpiryDate: string | null;
    };

/**
 * "Buscar cotización anterior" — retoma BUSCAR_BASE_VEHICULOS del Excel,
 * nunca implementado (EXCEL-AUDIT.md §5). Se audita porque revela PII de
 * un cliente ya existente, mismo criterio que el resto de este proyecto.
 */
export async function findRenewalData(documentNumber: string): Promise<RenewalLookupResult> {
  const session = await requirePermission("client:read_pii");

  return withOrganization(session.organizationId, async (tx) => {
    const result = await renewalService.findPreviousVehicleData(tx, documentNumber);
    if (!result) return { status: "NOT_FOUND" };
    if (!result.vehicle) {
      return {
        status: "NO_VEHICLE",
        clientFirstName: result.client.firstName,
        clientLastName: result.client.lastName,
      };
    }

    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "renewal.lookup",
      entityType: "clients",
      entityId: result.client.id,
    });

    const { vehicle, previousPolicy } = result;
    return {
      status: "FOUND",
      vehicle: {
        plate: vehicle.plate,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        bodyType: vehicle.bodyType,
        color: vehicle.color,
        commercialValueCents: vehicle.commercialValueCents,
        extrasValueCents: vehicle.extrasValueCents,
        hasTracker: vehicle.hasTracker,
        city: vehicle.city,
        province: vehicle.province,
      },
      previousInsurerId: previousPolicy?.policy.insurerId ?? null,
      previousInsurerName: previousPolicy?.insurerName ?? null,
      previousPolicyNumber: previousPolicy?.policy.policyNumber ?? null,
      previousExpiryDate: previousPolicy?.policy.endsAt ?? null,
    };
  });
}
