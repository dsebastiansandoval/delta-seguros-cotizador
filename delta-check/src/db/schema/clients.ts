import { bigint, boolean, date, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, organizationId, timestamps } from "./_helpers";
import { documentTypeEnum, genderEnum, insuredRelationEnum, personTypeEnum, regionEnum } from "./enums";
import { users } from "./identity";

/** 🏢 Persona natural o jurídica. Equivale a "DATOS" en `DATOS VH` del Excel. */
export const clients = pgTable("clients", {
  id: id(),
  organizationId: organizationId(),
  personType: personTypeEnum("person_type").notNull(),
  documentType: documentTypeEnum("document_type").notNull(),
  documentNumber: text("document_number").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  businessName: text("business_name"),
  email: text("email"),
  phone: text("phone"),
  source: text("source"), // FUENTE del Excel
  assignedAgentId: uuid("assigned_agent_id").references(() => users.id),
  ...timestamps,
});

/** 🏢 Un vehículo del cliente — soporta RIESGO 1..4 vía quote_risks. */
export const vehicles = pgTable("vehicles", {
  id: id(),
  organizationId: organizationId(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  plate: text("plate").notNull(),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  year: integer("year").notNull(),
  bodyType: text("body_type").notNull(), // LIVIANO | PICKUP (EXCEL-AUDIT.md §2.1)
  color: text("color"),
  chassis: text("chassis"),
  commercialValueCents: bigint("commercial_value_cents", { mode: "number" }).notNull(),
  extrasValueCents: bigint("extras_value_cents", { mode: "number" }).notNull().default(0),
  hasTracker: boolean("has_tracker").notNull().default(false), // afecta deducible de robo
  city: text("city"),
  ...timestamps,
});

/** 🏢 Grupo familiar de salud — titular + dependientes. */
export const insuredGroups = pgTable("insured_groups", {
  id: id(),
  organizationId: organizationId(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  region: regionEnum("region").notNull(),
  ...timestamps,
});

/** 🏢 Cada persona del grupo — edad y sexo son la clave de la tarifa de salud (EXCEL-AUDIT.md §2.3). */
export const insuredMembers = pgTable("insured_members", {
  id: id(),
  organizationId: organizationId(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => insuredGroups.id),
  relation: insuredRelationEnum("relation").notNull(),
  age: integer("age").notNull(),
  gender: genderEnum("gender").notNull(),
  birthDate: date("birth_date"),
});
