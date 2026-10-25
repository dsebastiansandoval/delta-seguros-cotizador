import { z } from "zod";

/**
 * Roles que el ADMIN de una organización puede asignar (ARCHITECTURE.md
 * §8.4). PLATFORM_ADMIN es cross-tenant y nunca se asigna desde acá.
 */
export const ASSIGNABLE_ROLES = ["ADMIN", "SUPERVISOR", "AGENTE", "LECTOR"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ROLE_LABELS: Record<AssignableRole, string> = {
  ADMIN: "Administrador",
  SUPERVISOR: "Supervisor",
  AGENTE: "Agente",
  LECTOR: "Lector",
};

const branches = z.array(z.enum(["AUTOS", "SALUD"])).transform((list) => [...new Set(list)]);

const userFields = {
  fullName: z.string().trim().min(1, "Ingresa el nombre"),
  role: z.enum(ASSIGNABLE_ROLES),
  branches,
};

export const createUserSchema = z.object({
  email: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.email("Correo inválido")),
  ...userFields,
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  userId: z.uuid(),
  ...userFields,
  isActive: z.boolean(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/** Los checkboxes llegan como `branches` repetido y `isActive=on`; FormData → objeto plano. */
export function userFormToObject(formData: FormData) {
  return {
    userId: formData.get("userId") ?? undefined,
    email: formData.get("email") ?? undefined,
    fullName: formData.get("fullName") ?? undefined,
    role: formData.get("role") ?? undefined,
    branches: formData.getAll("branches"),
    isActive: formData.get("isActive") === "on",
  };
}
