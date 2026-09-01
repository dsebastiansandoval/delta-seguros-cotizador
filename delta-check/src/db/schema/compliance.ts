import { inet, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, organizationId } from "./_helpers";
import { clients } from "./clients";
import { users } from "./identity";

/**
 * 🏢 Checkbox de aceptación de políticas — obligatorio antes de "Cotizar"
 * (ARCHITECTURE.md §9, cumplimiento LOPDP).
 */
export const consents = pgTable("consents", {
  id: id(),
  organizationId: organizationId(),
  userId: uuid("user_id").references(() => users.id),
  clientId: uuid("client_id").references(() => clients.id),
  policyVersion: text("policy_version").notNull(),
  termsVersion: text("terms_version").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
});

/**
 * 🏢 Append-only — sin permiso de UPDATE ni DELETE, ni para el propio backend
 * (se revoca a nivel de rol de base de datos, ver migración de RLS/grants y
 * ARCHITECTURE.md §8.3/§9).
 */
export const auditLogs = pgTable("audit_logs", {
  id: id(),
  organizationId: organizationId(),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
