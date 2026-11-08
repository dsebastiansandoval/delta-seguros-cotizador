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

export type Branch = "AUTOS" | "SALUD";

export type AuthorizedSession = {
  userId: string;
  organizationId: string;
  email: string;
  fullName: string | null;
  permissions: Set<string>;
  branches: Set<Branch>;
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
  const grants = await loadGrants();
  if (!grants) throw new UnauthenticatedError();
  if (!grants.permissions.has(permission)) throw new ForbiddenError(permission);
  return grants;
}

/**
 * Ramos que ve cada usuario (users.branches, fijado en /admin/usuarios).
 * Se valida en el servidor en cada acción del ramo — ocultar el link del
 * sidebar es solo comodidad.
 */
export function requireBranch(session: AuthorizedSession, branch: Branch) {
  if (!session.branches.has(branch)) throw new ForbiddenError(`branch:${branch}`);
}

/**
 * El campo "Ejecutivo" de una cotización (Autos/Salud) es texto libre, pero
 * solo quien tiene `quote:assign_executive` (ADMIN/SUPERVISOR) puede
 * ponerle el nombre de otra persona — el resto (Agente, Freelance) queda
 * fijo a su propio nombre, sin importar qué haya mandado el formulario.
 * Nunca se confía en que el cliente deshabilitó el campo.
 */
export function resolveExecutive(
  session: Pick<AuthorizedSession, "permissions" | "fullName">,
  submitted: string | undefined,
): string | undefined {
  if (session.permissions.has("quote:assign_executive")) return submitted;
  return session.fullName ?? undefined;
}

/** Para armar la navegación: null si no hay sesión válida, sin lanzar. */
export async function getAccess(): Promise<AuthorizedSession | null> {
  return loadGrants();
}

/**
 * Un usuario desactivado pierde el acceso en su siguiente request, aunque
 * su JWT siga vigente — por eso isActive se revisa acá y no solo al login.
 */
async function loadGrants(): Promise<AuthorizedSession | null> {
  const session = await getAppSession();
  if (!session?.organizationId) return null;

  const organizationId = session.organizationId;
  const email = session.email;

  const grants = await withOrganization(organizationId, async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !user.isActive) return null;

    const rows = await tx
      .select({ code: permissions.code })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(userRoles.userId, user.id));

    return { userId: user.id, fullName: user.fullName, codes: rows.map((r) => r.code), branches: user.branches };
  });

  if (!grants) return null;

  return {
    userId: grants.userId,
    organizationId,
    email,
    fullName: grants.fullName,
    permissions: new Set(grants.codes),
    branches: new Set(grants.branches),
  };
}
