import { boolean, jsonb, pgTable } from "drizzle-orm/pg-core";
import { id, organizationId, timestamps } from "./_helpers";
import { integrationProviderEnum } from "./enums";

/**
 * Qué sistema externo (SoftSeguros, y a futuro otros) tiene habilitado cada
 * broker, y sus credenciales cifradas a nivel de aplicación antes de escribir
 * (nunca texto plano en la columna). Resuelve que la integración sea opcional
 * por tenant sin bifurcar el producto — ver ARCHITECTURE.md §5b.3.
 */
export const organizationIntegrations = pgTable("organization_integrations", {
  id: id(),
  organizationId: organizationId(),
  provider: integrationProviderEnum("provider").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  credentials: jsonb("credentials"),
  config: jsonb("config"),
  ...timestamps,
});
