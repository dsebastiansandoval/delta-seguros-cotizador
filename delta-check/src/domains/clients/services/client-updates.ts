import type { NewClient } from "../repositories/client.repository";

/**
 * Datos del cliente que el ejecutivo puede corregir al volver a cotizar:
 * solo los que vinieron con valor, para no borrar lo que dejó en blanco.
 * Documento, tipo de persona, fuente y ejecutivo asignado no se tocan.
 */
export function editableClientUpdates(data: NewClient): Partial<NewClient> {
  const fields = ["firstName", "lastName", "businessName", "birthDate", "maritalStatus", "gender", "email", "phone"] as const;
  return Object.fromEntries(fields.filter((f) => data[f] != null && data[f] !== "").map((f) => [f, data[f]]));
}
