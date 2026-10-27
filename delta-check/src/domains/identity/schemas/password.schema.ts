import { z } from "zod";

const newPassword = z.string().min(8, "Mínimo 8 caracteres");

export const setPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las claves no coinciden",
    path: ["confirmPassword"],
  });
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

export const requestPasswordResetSchema = z.object({
  email: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.email("Correo inválido")),
});
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Ingresa tu clave actual"),
    newPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Las claves no coinciden",
    path: ["confirmPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
