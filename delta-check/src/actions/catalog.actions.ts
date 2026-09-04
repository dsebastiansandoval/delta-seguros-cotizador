"use server";

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { vehicleBrands } from "@/db/schema/catalog";
import { requirePermission } from "@/domains/identity/services/rbac.service";

/**
 * 🌐 Catálogo global, sin RLS (mismo trato que `insurers`/`coverages` —
 * ver ARCHITECTURE.md §1b, no está en la lista de tablas tenant-scoped).
 * Se consulta directo, sin withOrganization().
 */
export async function listVehicleBrands() {
  await requirePermission("quote:create");
  return db
    .select({ id: vehicleBrands.id, name: vehicleBrands.name })
    .from(vehicleBrands)
    .where(eq(vehicleBrands.isActive, true))
    .orderBy(asc(vehicleBrands.displayOrder));
}
