import { z } from "zod";

/**
 * Mismo bug de `""` vs `undefined` que en client.schema.ts — un <input>
 * vacío manda cadena vacía, no ausente.
 */
function optionalText() {
  return z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());
}

function optionalDate() {
  return z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());
}

/**
 * Nombres de campo = columnas reales de `BASE_EMISIONES`/`BASE_PENDIENTE`
 * (EXCEL-AUDIT.md §4): POLIZA, ANEXO, FACTURA. `quoteOptionId` identifica
 * de qué cotización cotizada (status COTIZADO) nace la póliza.
 */
export const emitPolicySchema = z.object({
  quoteOptionId: z.uuid(),
  policyNumber: optionalText(), // POLIZA — puede quedar pendiente (issue_status PENDIENTE) hasta que la aseguradora la asigne
  annexNumber: optionalText(), // ANEXO
  invoiceNumber: optionalText(), // FACTURA
  startsAt: optionalDate(),
  endsAt: optionalDate(),
  inspectionRequired: z.preprocess((v) => v === "on" || v === "true", z.boolean()).default(false),
  notes: optionalText(),
});
export type EmitPolicyInput = z.infer<typeof emitPolicySchema>;

/** Campos = columnas de BASE_CANCELADAS: PRIMA (cancelada) y ESTATUS (PENDIENTE / CANCELADA). */
export const cancelPolicySchema = z.object({
  policyId: z.uuid(),
  cancellationReason: z.string().min(1, "Indica el motivo de cancelación"),
  cancelledPremiumDollars: z.coerce.number().nonnegative("La prima cancelada no puede ser negativa"),
  confirmed: z.preprocess((v) => v === "on" || v === "true", z.boolean()).default(false),
});

export const confirmCancellationSchema = z.object({
  policyId: z.uuid(),
});

export const setIssueStatusSchema = z.object({
  policyId: z.uuid(),
  issueStatus: z.enum(["PENDIENTE", "INSPECCION", "NO_EMITIDA"]),
});

export const markPolicyPaidSchema = z.object({
  policyId: z.uuid(),
});

export const setPolicyNumberSchema = z.object({
  policyId: z.uuid(),
  policyNumber: z.string().min(1, "Número de póliza requerido"),
});

/** Genera N cuotas iguales (última ajustada por redondeo) desde una fecha base. */
export const generateInstallmentsSchema = z.object({
  policyId: z.uuid(),
  count: z.coerce.number().int().min(1).max(12), // BASE_PENDIENTE trae columnas 1..12
  totalDollars: z.coerce.number().positive(),
  firstDueDate: optionalDate(),
});

export const markInstallmentPaidSchema = z.object({
  installmentId: z.uuid(),
  policyId: z.uuid(), // para poder revalidar la ruta de vuelta
});

export const setCommissionSchema = z.object({
  commissionId: z.uuid(),
  percent: z.coerce.number().min(0).max(100),
});

export const markCommissionPaidSchema = z.object({
  commissionId: z.uuid(),
});

export const markCommissionDiscountedSchema = z.object({
  commissionId: z.uuid(),
  policyId: z.uuid().optional(), // para revalidar el detalle de la póliza
});

/**
 * Campos = columnas reales de `BASE_SINIESTROS` (EXCEL-AUDIT.md §4). RC es
 * la única lista de validación real en la hoja (SI/NO), de ahí el checkbox.
 */
export const reportClaimSchema = z.object({
  policyId: z.uuid(),
  claimNumber: optionalText(),
  occurredAt: optionalDate(),
  reportedAt: optionalDate(),
  description: optionalText(),
  workshop: optionalText(),
  advisorName: optionalText(),
  contactPhone: optionalText(),
  hasThirdPartyLiability: z.preprocess((v) => v === "on" || v === "true", z.boolean()).default(false),
  thirdPartyPlate: optionalText(),
  claimValueDollars: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().nonnegative().optional(),
  ),
  thirdPartyValueDollars: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().nonnegative().optional(),
  ),
  deductibleAppliedDollars: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().nonnegative().optional(),
  ),
});

export const updateClaimStatusSchema = z.object({
  claimId: z.uuid(),
  status: z.enum(["REPORTADO", "APROBADO", "REPARADO"]),
});

/** Novedad escrita a mano en el historial del siniestro — el "chat" que reemplaza la celda de observaciones del Excel. */
export const addClaimNoteSchema = z.object({
  claimId: z.uuid(),
  note: z.string().trim().min(1, "Escribe la novedad").max(2000),
});
