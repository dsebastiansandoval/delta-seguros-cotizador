"use server";

import { and, asc, eq } from "drizzle-orm";
import { db, withOrganization } from "@/db";
import { insurers, vehicleBrands, vehicleModels } from "@/db/schema/catalog";
import { listActiveUsersByBranch, requirePermission } from "@/domains/identity/services/rbac.service";

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

/**
 * 🏢 Lista de "Vendedor" de una cotización (reemplaza a la vieja lista de
 * "Ejecutivo" — ver rbac.service.ts) — sale de los usuarios activos del
 * sistema que ven ese ramo, para no mantener dos listas de personas que
 * pueden desincronizarse.
 */
export async function listQuoteVendors(branch: "AUTOS" | "SALUD") {
  const session = await requirePermission("quote:create");
  return withOrganization(session.organizationId, (tx) => listActiveUsersByBranch(tx, branch));
}

/** 🌐 Aseguradoras de Autos — "ASEGURADORA" de la póliza anterior en una renovación (DATOS VH!D18). */
export async function listAutoInsurers() {
  await requirePermission("quote:create");
  return db
    .select({ id: insurers.id, name: insurers.name })
    .from(insurers)
    .where(and(eq(insurers.branch, "AUTOS"), eq(insurers.isActive, true)))
    .orderBy(asc(insurers.name));
}

/**
 * 🌐 Aseguradoras de ambos ramos agrupadas — para el siniestro reportado
 * directo desde Siniestros, sin póliza: el ramo se elige en el formulario,
 * así que se trae todo de una vez y se cascadea en el navegador, mismo
 * patrón que listVehicleModelsByBrand().
 */
export async function listInsurersByBranch() {
  await requirePermission("claim:manage");
  const rows = await db
    .select({ id: insurers.id, name: insurers.name, branch: insurers.branch })
    .from(insurers)
    .where(eq(insurers.isActive, true))
    .orderBy(asc(insurers.name));

  const byBranch: Record<"AUTOS" | "SALUD", { id: string; name: string }[]> = { AUTOS: [], SALUD: [] };
  for (const row of rows) byBranch[row.branch].push({ id: row.id, name: row.name });
  return byBranch;
}
