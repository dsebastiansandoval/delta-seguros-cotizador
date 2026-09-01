import { eq } from "drizzle-orm";
import { getAppSession } from "@/lib/auth";
import { withOrganization } from "@/db";
import { permissions, rolePermissions, roles, userRoles, users } from "@/db/schema";

export class UnauthenticatedError extends Error {
  constructor() {
    super("No hay sesión activa");
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(public readonly permission: string) {
    super(`Falta el permiso: ${permission}`);
    this.name = "ForbiddenError";
  }
}

export type AuthorizedSession = {
  userId: string;
  organizationId: string;
  email: string;
  permissions: Set<string>;
};

/**
 * Puerta única de autorización — ARCHITECTURE.md §8.4: "la verificación de
 * permiso siempre valida rol y organization_id juntos". Se llama al inicio
 * de cada Server Action, nunca se confía solo en que la UI oculte un botón.
 *
 * TODO(cross-tenant): PLATFORM_ADMIN (organizationId nulo, §1b) todavía no
 * tiene flujo de resolución acá — no hay ningún PLATFORM_ADMIN sembrado
 * todavía (§11.4d no llegó a ese detalle operativo). Por ahora esta función
 * solo resuelve usuarios dentro de una organización.
 */
export async function requirePermission(permission: string): Promise<AuthorizedSession> {
  const session = await getAppSession();
  if (!session?.organizationId) throw new UnauthenticatedError();

  const organizationId = session.organizationId;
  const email = session.email;

  const grants = await withOrganization(organizationId, async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) return null;

    const rows = await tx
      .select({ code: permissions.code })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(userRoles.userId, user.id));

    return { userId: user.id, codes: rows.map((r) => r.code) };
  });

  if (!grants) throw new UnauthenticatedError();

  const grantedCodes = new Set(grants.codes);
  if (!grantedCodes.has(permission)) throw new ForbiddenError(permission);

  return { userId: grants.userId, organizationId, email, permissions: grantedCodes };
}
