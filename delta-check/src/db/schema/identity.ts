import { boolean, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, organizationId, timestamps } from "./_helpers";
import { authProviderEnum, branchEnum, roleCodeEnum } from "./enums";
import { organizations } from "./organizations";

/**
 * 🏢 Tenant-scoped, salvo PLATFORM_ADMIN (organizationId nulo — tu equipo,
 * cross-tenant). Ver ARCHITECTURE.md §4.2 y §8.4.
 */
export const users = pgTable("users", {
  id: id(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  provider: authProviderEnum("provider").notNull(),
  providerAccountId: text("provider_account_id"),
  isActive: boolean("is_active").notNull().default(true),
  // Ramos que el usuario puede cotizar y ver (Autos, Salud AM) — lo fija el ADMIN en /admin/usuarios.
  branches: branchEnum("branches").array().notNull().default(["AUTOS", "SALUD"]),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  ...timestamps,
});

/** 🌐 Catálogo fijo — no se crean roles nuevos por tenant, es un INSERT operativo, no producto. */
export const roles = pgTable("roles", {
  id: id(),
  code: roleCodeEnum("code").notNull().unique(),
  name: text("name").notNull(),
});

/** 🌐 quote:create, rate:edit, commission:read_all… */
export const permissions = pgTable("permissions", {
  id: id(),
  code: text("code").notNull().unique(),
});

/** 🌐 Qué permisos concede cada rol. */
export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

/** 🏢 Qué rol tiene cada usuario, dentro de su organización. */
export const userRoles = pgTable(
  "user_roles",
  {
    organizationId: organizationId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);
