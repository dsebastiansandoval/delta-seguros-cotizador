import { and, arrayContains, asc, eq, ilike } from "drizzle-orm";
import { getAppSession } from "@/lib/auth";
import { withOrganization, type Db } from "@/db";
import { permissions, rolePermissions, roles, userRoles, users, quoteVendors } from "@/db/schema";
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
 * Lista cerrada de "Vendedor" para Agente (`quote:select_vendor`) — unión
 * de los usuarios reales activos que ven ese ramo (fuente original, a
 * pedido de Delta: nunca se desincroniza con la nómina) MÁS el catálogo
 * `quoteVendors` (externos sin cuenta propia, que ADMIN/SUPERVISOR hace
 * crecer solo al escribir uno nuevo — ver ensureVendorExists más abajo).
 */
export async function listActiveUsersByBranch(tx: Db, branch: Branch): Promise<string[]> {
  const userRows = await tx
    .select({ fullName: users.fullName })
    .from(users)
    .where(and(eq(users.isActive, true), arrayContains(users.branches, [branch])))
    .orderBy(asc(users.fullName));
  const vendorRows = await tx
    .select({ name: quoteVendors.name })
    .from(quoteVendors)
    .where(eq(quoteVendors.isActive, true))
    .orderBy(asc(quoteVendors.name));
  const names = [...userRows.map((r) => r.fullName), ...vendorRows.map((r) => r.name)].filter(
    (n): n is string => Boolean(n),
  );
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

/**
 * Hace crecer el catálogo `quoteVendors` solo al escribir un nombre nuevo
 * en modo "free" (ver resolveVendor, vendor-assignment.ts) — idempotente:
 * si ya existe (por nombre, sin importar mayúsculas), no hace nada. No usa
 * formListsService.create() a propósito: esa función tira error si el
 * nombre ya existe (pensada para el ABM de /admin/configuracion, donde sí
 * es un error); acá un nombre repetido es el caso normal y esperado.
 */
export async function ensureVendorExists(tx: Db, organizationId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const [existing] = await tx
    .select({ id: quoteVendors.id })
    .from(quoteVendors)
    .where(and(eq(quoteVendors.organizationId, organizationId), ilike(quoteVendors.name, trimmed)));
  if (existing) return;
  await tx.insert(quoteVendors).values({ organizationId, name: trimmed }).onConflictDoNothing();
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
