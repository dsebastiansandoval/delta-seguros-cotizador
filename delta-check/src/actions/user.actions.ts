"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { withOrganization } from "@/db";
import { users, roles, userRoles } from "@/db/schema";
import { getAppSession } from "@/lib/auth";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { UserAdminError, userAdminService } from "@/domains/identity/services/user-admin.service";
import { createUserSchema, updateUserSchema, userFormToObject } from "@/domains/identity/schemas/user.schema";
import { clearImpersonationCookie, setImpersonationCookie } from "@/domains/identity/services/impersonation";
import { audit } from "@/domains/shared/audit";
import { sendPasswordSetupEmail } from "@/lib/email";
import { env } from "@/lib/env";
import type { ActionResult } from "./quote.actions";

export async function listUsers() {
  const session = await requirePermission("user:manage");
  return withOrganization(session.organizationId, (tx) => userAdminService.list(tx));
}

/** Botón "Generar link" de cada fila en /admin/usuarios — ver userAdminService.regenerateInviteLink. */
export async function generateInviteLink(userId: string): Promise<ActionResult<string>> {
  const session = await requirePermission("user:manage");
  try {
    const link = await withOrganization(session.organizationId, async (tx) => {
      const { resetToken } = await userAdminService.regenerateInviteLink(tx, userId);
      await audit(tx, {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "user.invite_link_regenerated",
        entityType: "users",
        entityId: userId,
      });
      return `${env.APP_URL}/crear-clave/${resetToken}`;
    });
    return { ok: true, value: link };
  } catch (error) {
    if (error instanceof UserAdminError) return { ok: false, errors: { form: [error.message] } };
    throw error;
  }
}

/**
 * Botón "Enviar correo" junto a "Generar link" — mismo token, pero además
 * lo manda por Resend (o lo deja en el log si RESEND_API_KEY no está
 * configurado, ver lib/email.ts). Emite un token nuevo en vez de reusar
 * uno ya copiado — mismo criterio que "Olvidé mi clave".
 */
export async function sendInviteEmail(userId: string): Promise<ActionResult<{ sent: boolean }>> {
  const session = await requirePermission("user:manage");
  try {
    const invite = await withOrganization(session.organizationId, async (tx) => {
      const { resetToken, email, fullName } = await userAdminService.regenerateInviteLink(tx, userId);
      await audit(tx, {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "user.invite_email_sent",
        entityType: "users",
        entityId: userId,
      });
      return { resetToken, email, fullName };
    });

    const { sent } = await sendPasswordSetupEmail({
      to: invite.email,
      fullName: invite.fullName,
      link: `${env.APP_URL}/crear-clave/${invite.resetToken}`,
      isNewAccount: false,
    });
    return { ok: true, value: { sent } };
  } catch (error) {
    if (error instanceof UserAdminError) return { ok: false, errors: { form: [error.message] } };
    throw error;
  }
}

export async function createUser(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("user:manage");

  const parsed = createUserSchema.safeParse(userFormToObject(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  let created: { email: string; fullName: string; resetToken: string } | undefined;
  try {
    await withOrganization(session.organizationId, async (tx) => {
      const { user, resetToken } = await userAdminService.create(tx, session.organizationId, parsed.data);
      created = { email: user.email, fullName: user.fullName, resetToken };
      await audit(tx, {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "user.created",
        entityType: "users",
        entityId: user.id,
        metadata: { role: parsed.data.role, branches: parsed.data.branches },
      });
    });
  } catch (error) {
    if (error instanceof UserAdminError) return { ok: false, errors: { form: [error.message] } };
    throw error;
  }

  // El correo se manda ya afuera de la transacción — si Resend falla, el
  // usuario igual queda creado (no hace falta deshacer el alta por un
  // correo caído; sin RESEND_API_KEY configurado, sendPasswordSetupEmail
  // deja el link en el log del servidor en vez de mandarlo).
  if (created) {
    await sendPasswordSetupEmail({
      to: created.email,
      fullName: created.fullName,
      link: `${env.APP_URL}/crear-clave/${created.resetToken}`,
      isNewAccount: true,
    });
  }

  revalidatePath("/admin/usuarios");
  return { ok: true, value: undefined };
}

/**
 * "Ver como este usuario" — arranca la suplantación (rbac.service.ts,
 * loadGrants resuelve el resto). Queda registrado en audit_logs con el
 * admin real como actor, para poder revisar después quién vio como quién
 * y cuándo.
 */
export async function startImpersonation(targetUserId: string): Promise<ActionResult<{ fullName: string }>> {
  const session = await requirePermission("user:impersonate");
  if (targetUserId === session.userId) {
    return { ok: false, errors: { form: ["Ya eres tú — no hace falta suplantarte."] } };
  }

  try {
    const target = await withOrganization(session.organizationId, async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, targetUserId)).limit(1);
      if (!user || !user.isActive) throw new UserAdminError("Ese usuario no existe o está desactivado.");
      await audit(tx, {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "user.impersonate_start",
        entityType: "users",
        entityId: targetUserId,
        metadata: { targetEmail: user.email },
      });
      return user;
    });

    await setImpersonationCookie(targetUserId);
    revalidatePath("/", "layout");
    return { ok: true, value: { fullName: target.fullName } };
  } catch (error) {
    if (error instanceof UserAdminError) return { ok: false, errors: { form: [error.message] } };
    throw error;
  }
}

/**
 * "Salir" del aviso de suplantación — a propósito NO pasa por
 * requirePermission: mientras se está suplantando a alguien, los permisos
 * resueltos son los DE ESE usuario (loadGrants), que seguramente no tiene
 * `user:impersonate` — exigirlo acá dejaría sin forma de salir. Solo
 * confirma que hay una sesión real de next-auth (cualquiera) y borra la
 * cookie; si no se estaba suplantando a nadie, no hace nada.
 */
export async function stopImpersonation(): Promise<ActionResult<void>> {
  const session = await getAppSession();
  if (!session) return { ok: false, errors: { form: ["No hay sesión activa."] } };

  await clearImpersonationCookie();
  revalidatePath("/", "layout");
  return { ok: true, value: undefined };
}

/** "Perfil" (menú de la cuenta, /cuenta) — nombre, correo y rol de quien está logueado. */
export async function getMyProfile() {
  const session = await requirePermission("quote:read");
  return withOrganization(session.organizationId, async (tx) => {
    const [row] = await tx
      .select({ fullName: users.fullName, email: users.email, roleCode: roles.code })
      .from(users)
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .leftJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(users.id, session.userId))
      .limit(1);
    return row ?? null;
  });
}

/** Guarda el nombre desde /cuenta — a diferencia de updateUser, cualquiera puede corregir el suyo propio, sin `user:manage`. */
export async function updateMyProfile(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("quote:read");

  const fullName = formData.get("fullName");
  if (typeof fullName !== "string" || !fullName.trim()) {
    return { ok: false, errors: { fullName: ["Ingresa el nombre"] } };
  }

  await withOrganization(session.organizationId, (tx) =>
    tx.update(users).set({ fullName: fullName.trim() }).where(eq(users.id, session.userId)),
  );

  revalidatePath("/", "layout");
  return { ok: true, value: undefined };
}

export async function updateUser(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("user:manage");

  const parsed = updateUserSchema.safeParse(userFormToObject(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  try {
    await withOrganization(session.organizationId, async (tx) => {
      await userAdminService.update(tx, session.organizationId, session.userId, parsed.data);
      await audit(tx, {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "user.updated",
        entityType: "users",
        entityId: parsed.data.userId,
        metadata: { role: parsed.data.role, branches: parsed.data.branches, isActive: parsed.data.isActive },
      });
    });
  } catch (error) {
    if (error instanceof UserAdminError) return { ok: false, errors: { form: [error.message] } };
    throw error;
  }

  revalidatePath("/admin/usuarios");
  return { ok: true, value: undefined };
}
