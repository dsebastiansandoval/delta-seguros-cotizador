import {
  bigint,
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { id, organizationId } from "./_helpers";
import {
  branchEnum,
  coverageValueTypeEnum,
  deductibleKindEnum,
  integrationModeEnum,
  rateTableVisibilityEnum,
} from "./enums";

/**
 * 🌐 Las 13 aseguradoras de Autos + 8 de Salud (EXCEL-AUDIT.md) — son las
 * mismas para cualquier broker ecuatoriano, no se recrean por tenant.
 */
export const insurers = pgTable("insurers", {
  id: id(),
  code: text("code").notNull().unique(), // AIG, ZURICH, SWEADEN, BMI, HUMANA...
  name: text("name").notNull(),
  branch: branchEnum("branch").notNull(),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").notNull().default(true),
  integrationMode: integrationModeEnum("integration_mode").notNull().default("MANUAL"),
});

/** 🌐 RC, AP, GM, AUTO_SUSTITUTO, AMPARO_PATRIMONIAL… */
export const coverages = pgTable("coverages", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  branch: branchEnum("branch").notNull(),
  valueType: coverageValueTypeEnum("value_type").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
});

/**
 * 🏢 Qué otorga cada aseguradora — versionado por vigencia, nunca se
 * sobreescribe (ARCHITECTURE.md §4.2: "nunca UPDATE destructivo").
 */
export const insurerCoverages = pgTable("insurer_coverages", {
  id: id(),
  organizationId: organizationId(),
  insurerId: uuid("insurer_id")
    .notNull()
    .references(() => insurers.id),
  coverageId: uuid("coverage_id")
    .notNull()
    .references(() => coverages.id),
  granted: boolean("granted").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }),
  textValue: text("text_value"),
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to"),
});

/**
 * 🏢 Con modo plantilla — ver ARCHITECTURE.md §1b. `organizationId` es
 * siempre el dueño real; `visibility = TEMPLATE` es lo único que la política
 * RLS deja leer entre tenants (nunca escribir). `clonedFromId` es
 * trazabilidad de qué plantilla originó una copia.
 */
export const rateTables = pgTable("rate_tables", {
  id: id(),
  organizationId: organizationId(),
  insurerId: uuid("insurer_id")
    .notNull()
    .references(() => insurers.id),
  branch: branchEnum("branch").notNull(),
  visibility: rateTableVisibilityEnum("visibility").notNull().default("PRIVATE"),
  clonedFromId: uuid("cloned_from_id"),
  isConfirmed: boolean("is_confirmed").notNull().default(true), // false en las recién clonadas
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to"),
  createdBy: uuid("created_by"),
});

/**
 * 🏢 Tasa por rango de valor, clase de vehículo y antigüedad — el motor real
 * que hoy solo tienen Latina y Cóndor en el Excel (EXCEL-AUDIT.md §2.1),
 * exportado en reference-data/autos_tasas_latina_condor_y_cargos.csv.
 */
export const rateRules = pgTable("rate_rules", {
  id: id(),
  rateTableId: uuid("rate_table_id")
    .notNull()
    .references(() => rateTables.id),
  vehicleYearMin: integer("vehicle_year_min"),
  vehicleYearMax: integer("vehicle_year_max"),
  valueMinCents: bigint("value_min_cents", { mode: "number" }),
  valueMaxCents: bigint("value_max_cents", { mode: "number" }),
  bodyType: text("body_type"), // LIVIANO | PICKUP
  usageType: text("usage_type"),
  ratePercent: numeric("rate_percent", { precision: 7, scale: 5 }).notNull(),
  minPremiumCents: bigint("min_premium_cents", { mode: "number" }),
  emissionFeeCents: bigint("emission_fee_cents", { mode: "number" }),
});

/** 🏢 Deducibles por pérdida parcial/total, con o sin dispositivo de rastreo. */
export const deductibleRules = pgTable("deductible_rules", {
  id: id(),
  organizationId: organizationId(),
  insurerId: uuid("insurer_id")
    .notNull()
    .references(() => insurers.id),
  kind: deductibleKindEnum("kind").notNull(),
  percentOfLoss: numeric("percent_of_loss", { precision: 5, scale: 2 }),
  percentOfInsuredValue: numeric("percent_of_insured_value", { precision: 5, scale: 2 }),
  minAmountCents: bigint("min_amount_cents", { mode: "number" }),
  requiresTracker: boolean("requires_tracker").notNull().default(false),
  textLabel: text("text_label"),
});
