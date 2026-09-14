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
  // Modalidad — ANUAL (con motor de tasas para Latina/Cóndor) o POR_KM
  // (100% manual para las 13, EXCEL-AUDIT.md §11.4b).
  modality: z.enum(["ANUAL", "POR_KM"]).default("ANUAL"),

  // Renovación — campos reales de "DATOS VH" y BASE_VEHICULOS del Excel
  // (CIA ANTERIOR, No. POLIZA, INICIO/FIN VIGENCIA), restaurados por el
  // macro BUSCAR_BASE_VEHICULOS que nunca se había mapeado — ver
  // EXCEL-AUDIT.md §5. Todos opcionales: una cotización NUEVA no los trae.
  operationType: z.enum(["NUEVA", "RENOVACION"]).default("NUEVA"),
  previousInsurerId: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
  previousPolicyNumber: optionalText(),
  previousExpiryDate: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),

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
  province: optionalText(),
});

export type NewClientVehicleInput = z.infer<typeof newClientVehicleSchema>;
