import { and, arrayContains, asc, eq } from "drizzle-orm";
import { getAppSession } from "@/lib/auth";
import { withOrganization, type Db } from "@/db";
import { permissions, rolePermissions, roles, userRoles, users } from "@/db/schema";
import { getImpersonationTargetUserId } from "./impersonation";

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
  /** Presente solo mientras alguien con `user:impersonate` está "viendo como" este usuario. */
  impersonatedBy?: { userId: string; email: string; fullName: string | null };
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

// resolveExecutive/vendorMode/resolveVendor viven en vendor-assignment.ts
// (lógica pura, sin esta importar `@/lib/auth`) — re-exportados acá para
// que nadie más tenga que cambiar de dónde los importa.
export { resolveExecutive, resolveVendor, vendorMode } from "./vendor-assignment";

/**
 * Usuarios activos de la organización que ven el ramo dado — fuente de la
 * lista de "Vendedor" (y, antes, de "Ejecutivo"): a pedido de Delta sale de
 * los usuarios reales del sistema, no de un catálogo aparte que se puede
 * desincronizar (mismo criterio que ya usaba "Ejecutivo" antes de volverse
 * un campo oculto).
 */
export async function listActiveUsersByBranch(tx: Db, branch: Branch): Promise<string[]> {
  const rows = await tx
    .select({ fullName: users.fullName })
    .from(users)
    .where(and(eq(users.isActive, true), arrayContains(users.branches, [branch])))
    .orderBy(asc(users.fullName));
  return rows.map((r) => r.fullName).filter((n): n is string => Boolean(n));
}

/** Para armar la navegación: null si no hay sesión válida, sin lanzar. */
export async function getAccess(): Promise<AuthorizedSession | null> {
  return loadGrants();
}

async function loadUserGrants(tx: Db, email: string) {
  const [user] = await tx.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.isActive) return null;

  const rows = await tx
    .select({ code: permissions.code })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(userRoles.userId, user.id));

  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    codes: rows.map((r) => r.code),
    branches: user.branches,
  };
}

/**
 * Un usuario desactivado pierde el acceso en su siguiente request, aunque
 * su JWT siga vigente — por eso isActive se revisa acá y no solo al login.
 *
 * Suplantación ("ver como este usuario", user.actions.ts): se resuelve acá,
 * en el único lugar del que depende el resto de la app, para que ningún
 * otro archivo tenga que enterarse — si la sesión REAL tiene
 * `user:impersonate` y hay una cookie de suplantación vigente apuntando a
 * otro usuario activo de la misma organización, se devuelven los permisos
 * de ESE usuario en vez de los propios. `impersonatedBy` siempre lleva
 * quién es el admin real, para el aviso en pantalla y para auditoría.
 */
async function loadGrants(): Promise<AuthorizedSession | null> {
  const session = await getAppSession();
  if (!session?.organizationId) return null;

  const organizationId = session.organizationId;
  const realEmail = session.email;

  const resolved = await withOrganization(organizationId, async (tx) => {
    const real = await loadUserGrants(tx, realEmail);
    if (!real) return null;

    const targetUserId = real.codes.includes("user:impersonate") ? await getImpersonationTargetUserId() : null;
    if (!targetUserId || targetUserId === real.userId) {
      return { grants: real, impersonatedBy: null };
    }

    const [targetUser] = await tx.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!targetUser || !targetUser.isActive || targetUser.organizationId !== organizationId) {
      return { grants: real, impersonatedBy: null };
    }

    const target = await loadUserGrants(tx, targetUser.email);
    if (!target) return { grants: real, impersonatedBy: null };

    return {
      grants: target,
      impersonatedBy: { userId: real.userId, email: real.email, fullName: real.fullName },
    };
  });

  if (!resolved) return null;
  const { grants, impersonatedBy } = resolved;

  return {
    userId: grants.userId,
    organizationId,
    email: grants.email,
    fullName: grants.fullName,
    permissions: new Set(grants.codes),
    branches: new Set(grants.branches),
    ...(impersonatedBy ? { impersonatedBy } : {}),
  };
}
