"use server";

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { vehicleBrands, vehicleModels } from "@/db/schema/catalog";
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

/**
 * Modelo en cascada según la marca — se trae todo de una vez (950 filas,
 * es un catálogo chico) y se agrupa por marca, en vez de una consulta por
 * cada cambio de marca: el cascadeo pasa a ser puramente en el navegador
 * (ver ModeloDatalist en NuevaCotizacionForm), sin depender de que el
 * servidor esté disponible mientras el ejecutivo está cotizando.
 */
export async function listVehicleModelsByBrand(): Promise<Record<string, string[]>> {
  await requirePermission("quote:create");
  const rows = await db
    .select({ brandName: vehicleBrands.name, modelName: vehicleModels.name })
    .from(vehicleModels)
    .innerJoin(vehicleBrands, eq(vehicleModels.brandId, vehicleBrands.id))
    .orderBy(asc(vehicleModels.displayOrder));

  const modelsByBrand: Record<string, string[]> = {};
  for (const row of rows) {
    (modelsByBrand[row.brandName] ??= []).push(row.modelName);
  }
  return modelsByBrand;
}
