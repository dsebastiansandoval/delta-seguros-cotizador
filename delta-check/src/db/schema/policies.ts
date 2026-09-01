import { bigint, boolean, date, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, organizationId, timestamps } from "./_helpers";
import { branchEnum, claimStatusEnum, commissionStatusEnum, issueStatusEnum, lifecycleStatusEnum, paymentStatusEnum } from "./enums";
import { quoteOptions } from "./quoting";
import { insurers } from "./catalog";
import { clients } from "./clients";
import { users } from "./identity";

/**
 * 🏢 Caché local de solo lectura cuando SoftSeguros está habilitado para el
 * tenant — la fuente de verdad post-emisión pasa a ser SoftSeguros, ver
 * ARCHITECTURE.md §5b.2. Sin esa integración, esta tabla es la única verdad.
 */
export const policies = pgTable("policies", {
  id: id(),
  organizationId: organizationId(),
  quoteOptionId: uuid("quote_option_id")
    .notNull()
    .references(() => quoteOptions.id),
  policyNumber: text("policy_number"),
  insurerId: uuid("insurer_id")
    .notNull()
    .references(() => insurers.id),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  branch: branchEnum("branch").notNull(),
  issueStatus: issueStatusEnum("issue_status").notNull().default("PENDIENTE"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("PENDIENTE"),
  lifecycleStatus: lifecycleStatusEnum("lifecycle_status").notNull().default("VIGENTE"),
  inspectionRequired: boolean("inspection_required").notNull().default(false),
  startsAt: date("starts_at"),
  endsAt: date("ends_at"),
  premiumCents: bigint("premium_cents", { mode: "number" }),
  // Trazabilidad de origen SoftSeguros y de pólizas "creadas por error"
  // (ver ARCHITECTURE.md §5b.4) — nunca se borran, se marcan.
  externalId: text("external_id"),
  isVoid: boolean("is_void").notNull().default(false),
  ...timestamps,
});

/** 🏢 Historial de cambio de estado, append-only. */
export const policyEvents = pgTable("policy_events", {
  id: id(),
  organizationId: organizationId(),
  policyId: uuid("policy_id")
    .notNull()
    .references(() => policies.id),
  eventType: text("event_type").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  notes: text("notes"),
  userId: uuid("user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 🏢 % de comisión, manual hasta que una API lo entregue (EXCEL-AUDIT.md §2.5). */
export const commissions = pgTable("commissions", {
  id: id(),
  organizationId: organizationId(),
  policyId: uuid("policy_id")
    .notNull()
    .references(() => policies.id),
  insurerId: uuid("insurer_id")
    .notNull()
    .references(() => insurers.id),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => users.id),
  baseAmountCents: bigint("base_amount_cents", { mode: "number" }).notNull(),
  percent: numeric("percent", { precision: 5, scale: 2 }),
  amountCents: bigint("amount_cents", { mode: "number" }),
  status: commissionStatusEnum("status").notNull().default("PENDIENTE"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

/** 🏢 Reportado → aprobado → reparado. */
export const claims = pgTable("claims", {
  id: id(),
  organizationId: organizationId(),
  policyId: uuid("policy_id")
    .notNull()
    .references(() => policies.id),
  claimNumber: text("claim_number"),
  status: claimStatusEnum("status").notNull().default("REPORTADO"),
  occurredAt: date("occurred_at"),
  reportedAt: date("reported_at"),
  description: text("description"),
  deductibleAppliedCents: bigint("deductible_applied_cents", { mode: "number" }),
});
