"use server";

import { and, asc, eq, arrayContains } from "drizzle-orm";
import { db, withOrganization } from "@/db";
import { insurers, vehicleBrands, vehicleModels } from "@/db/schema/catalog";
import { quoteSources } from "@/db/schema/clients";
import { users } from "@/db/schema/identity";
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

/**
 * 🏢 FUENTE del Excel (`INFO GENERAL!T15:T43`) — a diferencia de
 * `vehicleBrands`, es la nómina propia de cada tenant (quién trae
 * clientes), no un catálogo compartido — sí pasa por `withOrganization()`.
 */
export async function listQuoteSources() {
  const session = await requirePermission("quote:create");
  return withOrganization(session.organizationId, (tx) =>
    tx
      .select({ id: quoteSources.id, name: quoteSources.name })
      .from(quoteSources)
      .where(eq(quoteSources.isActive, true))
      .orderBy(asc(quoteSources.displayOrder)),
  );
}

/**
 * 🏢 EJECUTIVO del Excel (`DATOS VH!D8`, lista `INFO GENERAL!Y15:Y19`) —
 * distinto de FUENTE (ARCHITECTURE.md §24/§26). Antes era una lista aparte
 * editable en Configuración; a pedido de Delta ahora sale de los usuarios
 * activos del sistema que ven ese ramo, para no mantener dos listas de
 * personas que pueden desincronizarse.
 */
export async function listQuoteExecutives(branch: "AUTOS" | "SALUD") {
  const session = await requirePermission("quote:create");
  return withOrganization(session.organizationId, (tx) =>
    tx
      .select({ id: users.id, name: users.fullName })
      .from(users)
      .where(and(eq(users.isActive, true), arrayContains(users.branches, [branch])))
      .orderBy(asc(users.fullName)),
  );
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
