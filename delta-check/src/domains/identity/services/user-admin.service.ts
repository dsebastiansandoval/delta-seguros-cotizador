import { and, asc, eq, ne } from "drizzle-orm";
import type { Db } from "@/db";
import { roles, userRoles, users } from "@/db/schema/identity";
import { issuePasswordResetToken } from "./password.service";
import type { AssignableRole, CreateUserInput, UpdateUserInput } from "../schemas/user.schema";

/** Regla de administración violada — el mensaje se muestra tal cual al ADMIN. */
export class UserAdminError extends Error {}

const PG_UNIQUE_VIOLATION = "23505";

async function roleId(tx: Db, code: AssignableRole) {
  const [role] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.code, code));
  if (!role) throw new Error(`Rol ${code} no sembrado — corré npm run db:seed`);
  return role.id;
}

async function countOtherActiveAdmins(tx: Db, exceptUserId: string) {
  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(roles.code, "ADMIN"), eq(users.isActive, true), ne(users.id, exceptUserId)));
  return rows.length;
}

/**
 * ABM de usuarios de la organización (ARCHITECTURE.md §8.4, rol ADMIN).
 * La cuenta entra por correo+clave (provider "credentials") — `create()`
 * deja al usuario sin clave todavía y con un token de "crear clave" listo;
 * la Server Action (`user.actions.ts`) es quien manda el correo con el
 * link, para mantener el envío de correo fuera de la capa de servicio. Un
 * usuario nunca se borra — se desactiva, para conservar su historial de
 * cotizaciones y auditoría.
 */
export const userAdminService = {
  async list(tx: Db) {
    const rows = await tx
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        isActive: users.isActive,
        branches: users.branches,
        lastLoginAt: users.lastLoginAt,
        role: roles.code,
      })
      .from(users)
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .leftJoin(roles, eq(roles.id, userRoles.roleId))
      .orderBy(asc(users.fullName));

    // Un usuario tiene un rol por organización; si quedara más de uno, se muestra el primero.
    const byId = new Map<string, (typeof rows)[number]>();
    for (const row of rows) if (!byId.has(row.id)) byId.set(row.id, row);
    return [...byId.values()];
  },

  async create(tx: Db, organizationId: string, input: CreateUserInput) {
    let user;
    try {
      [user] = await tx
        .insert(users)
        .values({
          organizationId,
          email: input.email,
          fullName: input.fullName,
          provider: "credentials",
          branches: input.branches,
        })
        .returning();
    } catch (error) {
      // drizzle envuelve el error de pg en `cause`. La unicidad del correo es global (no la
      // filtra RLS), así que también detecta un correo usado en otra organización.
      const pgError = error as { code?: string; cause?: { code?: string } };
      if (pgError.code === PG_UNIQUE_VIOLATION || pgError.cause?.code === PG_UNIQUE_VIOLATION) {
        throw new UserAdminError("Ya existe una cuenta con ese correo");
      }
      throw error;
    }
    await tx.insert(userRoles).values({ organizationId, userId: user.id, roleId: await roleId(tx, input.role) });
    const resetToken = await issuePasswordResetToken(tx, user.id);
    return { user, resetToken };
  },

  /** El ADMIN no puede quitarse a sí mismo el acceso, y siempre queda al menos un ADMIN activo. */
  async update(tx: Db, organizationId: string, actingUserId: string, input: UpdateUserInput) {
    const [current] = await tx.select().from(users).where(eq(users.id, input.userId));
    if (!current) throw new UserAdminError("Usuario no encontrado");

    const losesAdmin = input.role !== "ADMIN" || !input.isActive;
    if (input.userId === actingUserId && losesAdmin) {
      throw new UserAdminError("No puedes quitarte el rol de administrador ni desactivar tu propia cuenta");
    }
    if (losesAdmin && (await countOtherActiveAdmins(tx, input.userId)) === 0) {
      const [{ code } = { code: null }] = await tx
        .select({ code: roles.code })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(eq(userRoles.userId, input.userId));
      if (code === "ADMIN" && current.isActive) throw new UserAdminError("Debe quedar al menos un administrador activo");
    }

    await tx
      .update(users)
      .set({ fullName: input.fullName, branches: input.branches, isActive: input.isActive, updatedAt: new Date() })
      .where(eq(users.id, input.userId));

    await tx.delete(userRoles).where(eq(userRoles.userId, input.userId));
    await tx.insert(userRoles).values({ organizationId, userId: input.userId, roleId: await roleId(tx, input.role) });
  },
};
