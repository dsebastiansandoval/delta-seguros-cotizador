import { z } from "zod";

function optionalText() {
  return z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());
}

export const createArcoRequestSchema = z.object({
  documentNumber: z.string().min(5, "Documento inválido"),
  type: z.enum(["ACCESO", "RECTIFICACION", "CANCELACION", "OPOSICION"]),
  channel: optionalText(),
  notes: optionalText(),
});

export const rectifyClientSchema = z.object({
  requestId: z.uuid(),
  clientId: z.uuid(),
  firstName: optionalText(),
  lastName: optionalText(),
  businessName: optionalText(),
  email: z.preprocess((v) => (v === "" ? undefined : v), z.email().optional()),
  phone: optionalText(),
});

export const anonymizeClientSchema = z.object({
  requestId: z.uuid(),
  clientId: z.uuid(),
});

export const setMarketingOptOutSchema = z.object({
  requestId: z.uuid(),
  clientId: z.uuid(),
  optOut: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export const updateArcoStatusSchema = z.object({
  requestId: z.uuid(),
  status: z.enum(["EN_PROCESO", "COMPLETADA", "RECHAZADA"]),
  resolutionNotes: optionalText(),
});
