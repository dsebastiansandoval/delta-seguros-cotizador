import type { NewClient } from "../repositories/client.repository";

/**
 * Datos del cliente que el ejecutivo puede corregir al volver a cotizar:
 * solo los que vinieron con valor, para no borrar lo que dejó en blanco.
 * Documento, tipo de persona y fuente no se tocan. `vendor` SÍ se
 * actualiza en cada cotización a propósito — a diferencia de `source`,
 * refleja quién vendió ESTA venta, no un atributo fijo del cliente.
 */
export function editableClientUpdates(data: NewClient): Partial<NewClient> {
  const fields = [
    "firstName",
    "lastName",
    "businessName",
    "birthDate",
    "maritalStatus",
    "gender",
    "email",
    "phone",
    "vendor",
  ] as const;
  return Object.fromEntries(fields.filter((f) => data[f] != null && data[f] !== "").map((f) => [f, data[f]]));
}
