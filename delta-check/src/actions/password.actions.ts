"use server";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/identity";
import {
  findUserByResetToken,
  issuePasswordResetToken,
  setPasswordAndConsumeToken,
  verifyPassword,
} from "@/domains/identity/services/password.service";
import {
  changePasswordSchema,
  requestPasswordResetSchema,
  setPasswordSchema,
} from "@/domains/identity/schemas/password.schema";
import { getAppSession } from "@/lib/auth";
import { sendPasswordSetupEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { rateLimit, RateLimitExceededError } from "@/lib/rate-limit";
import type { ActionResult } from "./quote.actions";

/**
 * `db` directo, sin `withOrganization` — estas 3 acciones corren antes de
 * tener sesión (o, en `changePassword`, sobre el propio usuario logueado),
 * mismo criterio ya documentado en auth.ts para el lookup de login bajo RLS.
 */

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "dev";
}

/**
 * Pantalla "Olvidé mi clave" — nunca revela si el correo existe o no (mismo
 * mensaje de éxito en ambos casos), para no dejar enumerar cuentas.
 */
export async function requestPasswordReset(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  try {
    await rateLimit(`password-reset:${await clientIp()}`, { limit: 5, window: "1 m" });
  } catch (error) {
    if (!(error instanceof RateLimitExceededError)) throw error;
    return { ok: true, value: undefined }; // mismo mensaje genérico — no delatar el límite tampoco
  }

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (user && user.isActive && user.provider === "credentials") {
    const resetToken = await issuePasswordResetToken(db, user.id);
    await sendPasswordSetupEmail({
      to: user.email,
      fullName: user.fullName,
      link: `${env.APP_URL}/crear-clave/${resetToken}`,
      isNewAccount: false,
    });
  }

  return { ok: true, value: undefined };
}

/** El link del correo (crear clave la primera vez, o recuperarla) cae acá. */
export async function setPassword(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = setPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  const user = await findUserByResetToken(db, parsed.data.token);
  if (!user || !user.isActive) {
    return { ok: false, errors: { form: ["Ese link venció o ya se usó — pedí uno nuevo."] } };
  }

  await setPasswordAndConsumeToken(db, user.id, parsed.data.password);
  return { ok: true, value: undefined };
}

/** `/cuenta/cambiar-clave` — ya logueado, pide la clave actual para confirmar identidad. */
export async function changePassword(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await getAppSession();
  if (!session) return { ok: false, errors: { form: ["Sesión expirada — volvé a entrar."] } };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  await rateLimit(`change-password:${session.userId}`, { limit: 5, window: "1 m" });

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user?.passwordHash || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return { ok: false, errors: { form: ["La clave actual no es correcta."] } };
  }

  await setPasswordAndConsumeToken(db, user.id, parsed.data.newPassword);
  return { ok: true, value: undefined };
}
