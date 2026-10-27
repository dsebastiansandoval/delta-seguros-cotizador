import { bigint, boolean, date, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, organizationId, timestamps } from "./_helpers";
import { documentTypeEnum, genderEnum, insuredRelationEnum, maritalStatusEnum, personTypeEnum, regionEnum } from "./enums";
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
  // Solo persona natural — DATOS VH!D14 (nacimiento), D16 (estado civil), H12 (género).
  birthDate: date("birth_date"),
  maritalStatus: maritalStatusEnum("marital_status"),
  gender: genderEnum("gender"),
  email: text("email"),
  phone: text("phone"),
  source: text("source"), // FUENTE del Excel
  // EJECUTIVO del Excel (DATOS VH!D8, distinto de FUENTE — confirmado en
  // ARCHITECTURE.md §24/§26) — quién de Delta gestionó la venta, no
  // necesariamente el mismo agente autenticado que cargó la cotización.
  executive: text("executive"),
  assignedAgentId: uuid("assigned_agent_id").references(() => users.id),
  // ARCO — Cancelación/Oposición (ARCHITECTURE.md §14). `isAnonymized` no
  // borra la fila (pólizas/siniestros ligados exigen retención legal) — ver
  // arcoService.anonymizeClient() para qué campos sí se redactan.
  isAnonymized: boolean("is_anonymized").notNull().default(false),
  anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
  marketingOptOut: boolean("marketing_opt_out").notNull().default(false),
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
  // 24 provincias reales de Ecuador (catálogo INEC, ver
  // domains/lookup/cedula.validator.ts) — selector, no texto libre como
  // `city`, porque a diferencia de la ciudad sí hay una lista cerrada y
  // estable que vale la pena ofrecer.
  province: text("province"),
  ...timestamps,
});

/**
 * 🏢 FUENTE del Excel (`INFO GENERAL!T15:T43`, confirmado como el rango
 * real de la validación de datos de `DATOS VH!H14` — no el segundo bloque
 * `T50:T62`, que tiene el mismo encabezado pero ninguna validación lo usa)
 * — quién trajo al cliente. Es tenant-scoped y no un catálogo 🌐 como
 * `vehicleBrands`: es la nómina propia de Delta, no algo que otro tenant
 * de Cotizador Delta Seguros deba ver. `clients.source` se queda como texto libre
 * (soporta "Otra") — esta tabla es solo el catálogo cerrado que alimenta
 * el selector, igual que `vehicleBrands` alimenta el de Marca.
 */
export const quoteSources = pgTable(
  "quote_sources",
  {
    id: id(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [uniqueIndex("quote_sources_org_name_idx").on(t.organizationId, t.name)],
);

/**
 * 🏢 EJECUTIVO del Excel (`DATOS VH!D8`, lista `INFO GENERAL!$Y$15:$Y$19`)
 * — distinto de FUENTE (confirmado en ARCHITECTURE.md §24/§26: son dos
 * dropdowns reales y separados, no uno redundante con el otro). Mismo
 * criterio que `quoteSources`: tenant-scoped, no un catálogo global.
 * `clients.executive` se queda como texto libre (soporta "Otra").
 */
export const quoteExecutives = pgTable(
  "quote_executives",
  {
    id: id(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [uniqueIndex("quote_executives_org_name_idx").on(t.organizationId, t.name)],
);

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
