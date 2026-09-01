import { timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/** `id uuid primary key default gen_random_uuid()` — igual en todas las tablas. */
export const id = () => uuid("id").primaryKey().defaultRandom();

/** `created_at` / `updated_at` estándar, en todas las tablas de negocio. */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/**
 * FK obligatoria a `organizations`. Todas las tablas marcadas 🏢 en
 * ARCHITECTURE.md §4.2 la usan — es la columna que la política RLS de cada
 * tabla filtra (ver §1b y las migraciones de `db/migrations/rls/`).
 */
export const organizationId = () =>
  uuid("organization_id")
    .notNull()
    .references(() => organizations.id);
