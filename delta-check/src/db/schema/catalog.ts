import {
  bigint,
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, organizationId } from "./_helpers";
import {
  branchEnum,
  coverageValueTypeEnum,
  deductibleKindEnum,
  genderEnum,
  insuredRelationEnum,
  integrationModeEnum,
  rateTableVisibilityEnum,
  regionEnum,
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
  // Hoy solo AIG vende Auto x Km; las demás se habilitan cambiando este flag.
  supportsKm: boolean("supports_km").notNull().default(false),
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
 * 🌐 Catálogo de marcas para el selector de "Nueva cotización — Autos", en
 * vez de texto libre. El Excel sí tenía este dropdown (`DATOS VH!D9`), pero
 * su lista de origen fue borrada — la validación de datos quedó apuntando a
 * `#REF!`, sin rastro del catálogo real en ningún nombre definido del
 * libro. Este catálogo se compiló de cero, curado a partir del catálogo
 * público real de marcas de un bróker ecuatoriano (Prodeseg,
 * `/api/public/marcas`, sin autenticación) filtrado a lo que aplica a
 * Autos LIVIANO/PICKUP — se excluyeron camiones pesados, motos y
 * maquinaria, que ellos también cubren pero Cotizador Delta Seguros no cotiza. El
 * formulario igual deja "Otra" como texto libre — ningún catálogo de
 * marcas es exhaustivo para siempre.
 */
export const vehicleBrands = pgTable("vehicle_brands", {
  id: id(),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
});

/**
 * 🌐 Modelo en cascada según la marca elegida — mismo origen y mismo
 * criterio que vehicleBrands (Prodeseg `/api/public/marcas` +
 * `/api/public/modelos?idM=`, sin autenticación, namespace ya usado y
 * documentado ahí). Se seedea una sola vez desde
 * reference-data/vehicle_models.json en vez de consultarse en vivo en cada
 * cotización — igual que el catálogo de marcas, para no depender de la
 * disponibilidad de un tercero durante el flujo de cotizar. El formulario
 * igual deja el modelo como texto libre editable: si no aparece en la
 * lista, se escribe a mano.
 */
export const vehicleModels = pgTable(
  "vehicle_models",
  {
    id: id(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => vehicleBrands.id),
    name: text("name").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [uniqueIndex("vehicle_models_brand_name_idx").on(t.brandId, t.name)],
);

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
  // Antigüedad del vehículo en años (currentYear - año del vehículo), no
  // año de fabricación — así la regla sigue siendo válida al pasar los años
  // calendario. Ver EXCEL-AUDIT.md §2.1: la fórmula real del Excel es
  // YEAR(TODAY()) - año_vehículo, comparada contra <=10, 11-13, >13.
  vehicleAgeMin: integer("vehicle_age_min"),
  vehicleAgeMax: integer("vehicle_age_max"),
  valueMinCents: bigint("value_min_cents", { mode: "number" }),
  valueMaxCents: bigint("value_max_cents", { mode: "number" }),
  bodyType: text("body_type"), // LIVIANO | PICKUP
  usageType: text("usage_type"),
  ratePercent: numeric("rate_percent", { precision: 7, scale: 5 }).notNull(),
  minPremiumCents: bigint("min_premium_cents", { mode: "number" }),
  emissionFeeCents: bigint("emission_fee_cents", { mode: "number" }),
});

/**
 * 🏢 Tarifas de Salud — edad × sexo × región × plan × deducible, no "tasa
 * sobre valor asegurado" como Autos (EXCEL-AUDIT.md §2.3/§2.4: Salud no
 * aplica impuestos ecuatorianos, la prima de la tabla YA es el total por
 * persona). `premiumCents` es directo, sin desglose de IVA/SB/campesino.
 * `gender`/`region`/`deductibleCode` nulos significan "aplica a cualquiera"
 * (ej. Humana no distingue región; el plan "Plan Predilecto" de VB sí
 * distingue sexo pero no región).
 */
export const healthRateRules = pgTable("health_rate_rules", {
  id: id(),
  rateTableId: uuid("rate_table_id")
    .notNull()
    .references(() => rateTables.id),
  planCode: text("plan_code").notNull(), // "SIGMA", "METROHUMANA_150"...
  ageMin: integer("age_min").notNull(),
  ageMax: integer("age_max").notNull(),
  gender: genderEnum("gender"),
  region: regionEnum("region"),
  // Algunas aseguradoras tarifan distinto al titular y a los dependientes (Humana PH15K: tabla
  // individual vs. familiar). Nulo = aplica a ambos.
  relation: insuredRelationEnum("relation"),
  deductibleCode: text("deductible_code"), // "D150", "I150"... nulo si el plan no distingue
  premiumCents: bigint("premium_cents", { mode: "number" }).notNull(),
});

/**
 * 🌐 Grilla de sublímites/copago/carencia por plan de Salud — equivalente a
 * la hoja `OFERTA AM` del Excel (la que imprime la macro `IMPRIMIR_OFERTA_AM`
 * y es lo que Delta manda hoy al cliente, no `CARATULA AM`). Son valores
 * FIJOS por plan (SIGMA 150 siempre tiene el mismo deducible, no varía por
 * cliente) — por eso van como catálogo, igual que `healthRateRules`, no
 * como captura manual repetida en cada cotización (eso sigue existiendo en
 * `quote_option_coverages` para cuando el ejecutivo necesite anotar algo
 * puntual). `planCode` es el mismo valor que `quoteOptions.planCode`.
 * `copago`/`carencia` quedan null para las aseguradoras cuyo Excel solo
 * trae un valor de "SUB LIMITES" sin desglosar (confirmado celda por celda:
 * BMI y Confiamed sí traen las 3 columnas separadas; SaludSA/Humana/Salud
 * genérico/Pro/VB solo traen una).
 */
export const healthPlanCoverages = pgTable("health_plan_coverages", {
  id: id(),
  insurerId: uuid("insurer_id")
    .notNull()
    .references(() => insurers.id),
  planCode: text("plan_code").notNull(),
  section: text("section").notNull(), // "COBERTURAS" | "MATERNIDAD" | "TOPE_CONSULTA" | "PERIODOS_CARENCIA"
  label: text("label").notNull(),
  displayOrder: integer("display_order").notNull(),
  copago: text("copago"),
  sublimite: text("sublimite"),
  carencia: text("carencia"),
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
