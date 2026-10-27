import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Todos los enums del esquema en un solo lugar. Documentados en
 * ARCHITECTURE.md §4.2. La mayoría vienen de una fórmula o estructura real
 * del Excel (EXCEL-AUDIT.md) — la excepción es issue/payment/lifecycle/
 * commission/claim status (cartera, comisiones, siniestros): en el Excel la
 * columna ESTATUS de esas 5 hojas es texto libre, sin lista de validación ni
 * fórmula que fije un vocabulario (confirmado revisando las macros
 * ALTA_EN_BASE_* — ninguna escribe un literal en esa columna). Los valores
 * de esos 5 enums son una decisión de diseño de Cotizador Delta Seguros, no un hecho
 * extraído del Excel — se documentan así en vez de inventar una "fuente".
 */

export const roleCodeEnum = pgEnum("role_code", [
  "PLATFORM_ADMIN",
  "ADMIN",
  "SUPERVISOR",
  "AGENTE",
  "LECTOR",
]);

export const authProviderEnum = pgEnum("auth_provider", ["microsoft", "google", "email", "credentials"]);

export const personTypeEnum = pgEnum("person_type", ["NATURAL", "JURIDICA"]);
export const documentTypeEnum = pgEnum("document_type", ["CEDULA", "RUC", "PASAPORTE"]);
export const genderEnum = pgEnum("gender", ["MASCULINO", "FEMENINO"]);
// INFO GENERAL!AB26:AB30 — lista de DATOS VH!D16.
export const maritalStatusEnum = pgEnum("marital_status", ["CASADO", "DIVORCIADO", "SOLTERO", "UNION_DE_HECHO", "VIUDO"]);
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
// DATOS OFERTA fila 80: "Sí otorga" (todo riesgo) / "Solo pérdida total".
export const autoCoverageTypeEnum = pgEnum("auto_coverage_type", ["TODO_RIESGO", "SOLO_PERDIDA_TOTAL"]);
export const quoteSourceEnum = pgEnum("quote_source", ["MANUAL", "API"]);
export const paymentMethodEnum = pgEnum("payment_method", ["CONTADO", "TARJETA"]);

// INSPECCION = estatus propio de BASE EMISIONES (INFO GENERAL!AD30): la aseguradora espera la inspección del vehículo.
export const issueStatusEnum = pgEnum("issue_status", ["PENDIENTE", "INSPECCION", "EMITIDA", "NO_EMITIDA"]);
export const paymentStatusEnum = pgEnum("payment_status", ["PENDIENTE", "PAGADO"]);
// CANCELACION_PENDIENTE = ESTATUS "PENDIENTE" de BASE CANCELADAS: pedida pero la aseguradora aún no la confirma.
export const lifecycleStatusEnum = pgEnum("lifecycle_status", ["VIGENTE", "CANCELACION_PENDIENTE", "CANCELADA"]);
export const commissionStatusEnum = pgEnum("commission_status", ["PENDIENTE", "COMISIONADA"]);
// Columna COMISION de BASE CANCELADAS (INFO GENERAL!AG34:AG35).
export const commissionDiscountStatusEnum = pgEnum("commission_discount_status", ["PENDIENTE", "DESCONTADA"]);
export const claimStatusEnum = pgEnum("claim_status", ["REPORTADO", "APROBADO", "REPARADO"]);

export const integrationProviderEnum = pgEnum("integration_provider", ["SOFTSEGUROS"]);

/**
 * ARCO — derechos LOPDP (Ecuador) del titular de datos: Acceso, Rectificación,
 * Cancelación, Oposición. Sin equivalente en el Excel (no es un dato de
 * negocio del cotizador) — diseño propio de Cotizador Delta Seguros, ver ARCHITECTURE.md
 * §9/§14.
 */
export const arcoRequestTypeEnum = pgEnum("arco_request_type", [
  "ACCESO",
  "RECTIFICACION",
  "CANCELACION",
  "OPOSICION",
]);
export const arcoRequestStatusEnum = pgEnum("arco_request_status", [
  "RECIBIDA",
  "EN_PROCESO",
  "COMPLETADA",
  "RECHAZADA",
]);
