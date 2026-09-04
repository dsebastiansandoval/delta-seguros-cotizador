import { inet, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, organizationId } from "./_helpers";
import { arcoRequestStatusEnum, arcoRequestTypeEnum } from "./enums";
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

/**
 * 🏢 Solicitud ARCO del titular — Acceso/Rectificación/Cancelación/Oposición
 * (ARCHITECTURE.md §9/§14, LOPDP Ecuador). `channel` es texto libre (cómo
 * llegó el pedido — igual que ESTATUS en las hojas BASE_* del Excel, no hay
 * un vocabulario fijo que copiar de ningún lado porque esto no existe en el
 * Excel). Un agente registra el pedido; SUPERVISOR/ADMIN lo procesa
 * (compliance:manage) — separación real de responsabilidad, no cosmética.
 */
export const arcoRequests = pgTable("arco_requests", {
  id: id(),
  organizationId: organizationId(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  type: arcoRequestTypeEnum("type").notNull(),
  status: arcoRequestStatusEnum("status").notNull().default("RECIBIDA"),
  channel: text("channel"), // cómo llegó el pedido: email, teléfono, presencial...
  notes: text("notes"),
  requestedByUserId: uuid("requested_by_user_id").references(() => users.id),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolutionNotes: text("resolution_notes"),
});
