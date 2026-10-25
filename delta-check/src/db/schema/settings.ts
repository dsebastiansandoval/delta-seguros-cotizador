import { jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, organizationId, timestamps } from "./_helpers";

/**
 * 🏢 Configuración editable por organización desde /admin/configuracion,
 * una fila por clave (ej. `autos.engine_rates`: tablas de Latina y Cóndor).
 * Sin fila = se usa el default del código (los valores del Excel). El
 * `value` se valida con zod al leer y al escribir, no en la DB.
 */
export const organizationSettings = pgTable(
  "organization_settings",
  {
    id: id(),
    organizationId: organizationId(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    updatedBy: uuid("updated_by"),
    ...timestamps,
  },
  (t) => [uniqueIndex("organization_settings_org_key_idx").on(t.organizationId, t.key)],
);
