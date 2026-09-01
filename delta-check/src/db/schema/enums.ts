import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Todos los enums del esquema en un solo lugar. Los valores son los mismos
 * que aparecen en ARCHITECTURE.md §4.2 y en EXCEL-AUDIT.md — no se inventó
 * ningún estado nuevo que no viniera del Excel o de la decisión documentada.
 */

export const roleCodeEnum = pgEnum("role_code", [
  "PLATFORM_ADMIN",
  "ADMIN",
  "SUPERVISOR",
  "AGENTE",
  "LECTOR",
]);

export const authProviderEnum = pgEnum("auth_provider", ["microsoft", "google", "email"]);

export const personTypeEnum = pgEnum("person_type", ["NATURAL", "JURIDICA"]);
export const documentTypeEnum = pgEnum("document_type", ["CEDULA", "RUC", "PASAPORTE"]);
export const genderEnum = pgEnum("gender", ["MASCULINO", "FEMENINO"]);
export const regionEnum = pgEnum("region", ["SIERRA", "COSTA", "AUSTRO"]);
export const insuredRelationEnum = pgEnum("insured_relation", ["TITULAR", "DEPENDIENTE"]);

export const branchEnum = pgEnum("branch", ["AUTOS", "SALUD"]);
export const integrationModeEnum = pgEnum("integration_mode", ["MANUAL", "API"]);
export const coverageValueTypeEnum = pgEnum("coverage_value_type", ["BOOLEAN", "AMOUNT", "TEXT"]);
export const rateTableVisibilityEnum = pgEnum("rate_table_visibility", ["PRIVATE", "TEMPLATE"]);
export const deductibleKindEnum = pgEnum("deductible_kind", [
  "PARCIAL",
  "TOTAL_DANO",
  "TOTAL_ROBO",
]);

export const quoteStatusEnum = pgEnum("quote_status", [
  "BORRADOR",
  "ENVIADA",
  "ACEPTADA",
  "VENCIDA",
]);
export const operationTypeEnum = pgEnum("operation_type", ["NUEVA", "RENOVACION"]);
export const modalityEnum = pgEnum("modality", ["ANUAL", "POR_KM"]);
export const quoteSourceEnum = pgEnum("quote_source", ["MANUAL", "API"]);
export const paymentMethodEnum = pgEnum("payment_method", ["CONTADO", "TARJETA"]);

export const issueStatusEnum = pgEnum("issue_status", ["PENDIENTE", "EMITIDA", "NO_EMITIDA"]);
export const paymentStatusEnum = pgEnum("payment_status", ["PENDIENTE", "PAGADO"]);
export const lifecycleStatusEnum = pgEnum("lifecycle_status", ["VIGENTE", "CANCELADA"]);
export const commissionStatusEnum = pgEnum("commission_status", ["PENDIENTE", "COMISIONADA"]);
export const claimStatusEnum = pgEnum("claim_status", ["REPORTADO", "APROBADO", "REPARADO"]);

export const integrationProviderEnum = pgEnum("integration_provider", ["SOFTSEGUROS"]);
