import { z } from "zod";

/**
 * Un input de texto opcional de un <input> HTML manda `""` cuando queda
 * vacío, no `undefined` — `.optional()` a secas no cubre ese caso (`""` no
 * es `undefined`, así que `.min(1)` lo sigue rechazando). Bug real,
 * encontrado probando el formulario en el navegador, no en un test
 * aislado: ver ARCHITECTURE.md — el mismo espíritu que el bug de
 * `SET LOCAL` en src/db/index.ts, otro caso de "solo se ve corriendo la
 * app de verdad".
 */
function optionalText() {
  return z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());
}

/**
 * Un solo esquema, compartido entre el formulario (cliente) y la Server
 * Action (servidor) — ARCHITECTURE.md §1. Los nombres de campo replican
 * "DATOS VH" del Excel (EXCEL-AUDIT.md), no se inventaron de cero.
 */
export const newClientVehicleSchema = z.object({
  // Cliente
  personType: z.enum(["NATURAL", "JURIDICA"]),
  documentType: z.enum(["CEDULA", "RUC", "PASAPORTE"]),
  documentNumber: z.string().min(5, "Documento inválido"),
  firstName: optionalText(),
  lastName: optionalText(),
  businessName: optionalText(),
  email: z.preprocess((v) => (v === "" ? undefined : v), z.email().optional()),
  phone: optionalText(),
  source: optionalText(),

  // Vehículo (Riesgo 1)
  plate: z.string().min(6, "Placa inválida").max(8),
  brand: z.string().min(1),
  model: z.string().min(1),
  year: z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1),
  bodyType: z.enum(["LIVIANO", "PICKUP"]),
  color: optionalText(),
  commercialValueDollars: z.coerce.number().positive("El valor asegurado debe ser mayor a 0"),
  extrasValueDollars: z.coerce.number().min(0).default(0),
  hasTracker: z.coerce.boolean().default(false),
  city: optionalText(),
});

export type NewClientVehicleInput = z.infer<typeof newClientVehicleSchema>;
