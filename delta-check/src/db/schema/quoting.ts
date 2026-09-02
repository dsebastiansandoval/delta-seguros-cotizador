import {
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { id, organizationId, timestamps } from "./_helpers";
import { branchEnum, modalityEnum, operationTypeEnum, paymentMethodEnum, quoteSourceEnum, quoteStatusEnum } from "./enums";
import { clients, insuredGroups, vehicles } from "./clients";
import { coverages, insurers } from "./catalog";
import { users } from "./identity";

/** 🏢 Nueva o renovación. `code` es el correlativo visible tipo COT-2026-00184. */
export const quotes = pgTable("quotes", {
  id: id(),
  organizationId: organizationId(),
  code: text("code").notNull(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => users.id),
  branch: branchEnum("branch").notNull(),
  operationType: operationTypeEnum("operation_type").notNull(),
  status: quoteStatusEnum("status").notNull().default("BORRADOR"),
  previousInsurerId: uuid("previous_insurer_id").references(() => insurers.id),
  previousPolicyNumber: text("previous_policy_number"),
  previousExpiryDate: date("previous_expiry_date"),
  validUntil: date("valid_until"),
  ...timestamps,
});

/** 🏢 Riesgo 1 a 4 por cotización — vehículo o grupo de salud (RIESGO 1..4 del Excel). */
export const quoteRisks = pgTable("quote_risks", {
  id: id(),
  organizationId: organizationId(),
  quoteId: uuid("quote_id")
    .notNull()
    .references(() => quotes.id),
  riskNumber: integer("risk_number").notNull(), // 1..4
  vehicleId: uuid("vehicle_id").references(() => vehicles.id),
  insuredGroupId: uuid("insured_group_id").references(() => insuredGroups.id),
  insuredValueCents: bigint("insured_value_cents", { mode: "number" }),
  extrasValueCents: bigint("extras_value_cents", { mode: "number" }).default(0),
});

/**
 * 🏢 Una oferta por aseguradora. Los campos de impuestos son literales del
 * Excel (SB 3.5%, seguro campesino 0.5%, IVA 15% — ver EXCEL-AUDIT.md §2.4).
 */
export const quoteOptions = pgTable("quote_options", {
  id: id(),
  organizationId: organizationId(),
  quoteRiskId: uuid("quote_risk_id")
    .notNull()
    .references(() => quoteRisks.id),
  insurerId: uuid("insurer_id")
    .notNull()
    .references(() => insurers.id),
  modality: modalityEnum("modality").notNull().default("ANUAL"),
  // Solo cuando modality = POR_KM — uno de KM_BRACKETS (900|1500|3000|5000|7500|10000),
  // ver domains/quoting/services/km.constants.ts. Nulo en modalidad ANUAL.
  kmBracket: integer("km_bracket"),
  // Solo branch = SALUD — una aseguradora puede ofrecer varios planes (BMI:
  // Sigma/Innova/GMM). Nulo en Autos, donde insurerId ya alcanza para
  // identificar la fila.
  planCode: text("plan_code"),
  netPremiumCents: bigint("net_premium_cents", { mode: "number" }),
  superBancosCents: bigint("super_bancos_cents", { mode: "number" }), // 3.50%
  campesinoCents: bigint("campesino_cents", { mode: "number" }), // 0.50%
  emissionFeeCents: bigint("emission_fee_cents", { mode: "number" }),
  ivaCents: bigint("iva_cents", { mode: "number" }), // 15%
  totalPremiumCents: bigint("total_premium_cents", { mode: "number" }),
  ratePercentApplied: numeric("rate_percent_applied", { precision: 7, scale: 5 }),
  source: quoteSourceEnum("source").notNull().default("MANUAL"),
  rawResponse: jsonb("raw_response"), // respuesta cruda de API, cuando aplique (Fase 4)
  quotedAt: timestamp("quoted_at", { withTimezone: true }).notNull().defaultNow(),
  isRecommended: boolean("is_recommended").notNull().default(false),
});

/**
 * 🏢 Snapshot inmutable de la cobertura al momento de cotizar — regla clave
 * de ARCHITECTURE.md §4.2: si la aseguradora cambia condiciones mañana, la
 * oferta ya enviada sigue siendo reproducible tal cual se emitió.
 */
export const quoteOptionCoverages = pgTable("quote_option_coverages", {
  id: id(),
  organizationId: organizationId(),
  quoteOptionId: uuid("quote_option_id")
    .notNull()
    .references(() => quoteOptions.id),
  coverageId: uuid("coverage_id")
    .notNull()
    .references(() => coverages.id),
  granted: boolean("granted").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }),
  textValue: text("text_value"),
});

/** 🏢 Contado o tarjeta a 6/9/12 meses, con o sin interés. */
export const paymentOptions = pgTable("payment_options", {
  id: id(),
  organizationId: organizationId(),
  quoteOptionId: uuid("quote_option_id")
    .notNull()
    .references(() => quoteOptions.id),
  method: paymentMethodEnum("method").notNull(),
  installments: integer("installments"), // 6 | 9 | 12
  hasInterest: boolean("has_interest").notNull().default(false),
  installmentAmountCents: bigint("installment_amount_cents", { mode: "number" }),
});
