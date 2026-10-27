/**
 * Crea la organización "Delta Seguros" (si no existe) y el primer usuario
 * ADMIN, con un token de "crear clave" listo — el huevo-y-gallina que
 * `createUser()` no puede resolver solo (esa Server Action exige ya estar
 * logueado como ADMIN de la organización). Solo para el primer arranque de
 * un entorno nuevo; usuarios siguientes se dan de alta desde
 * /admin/usuarios una vez que el primero puede entrar.
 *
 * Uso: npx tsx src/db/bootstrap-admin.ts "Nombre Completo" correo@ejemplo.com
 */
import { eq } from "drizzle-orm";
import { db } from "./index";
import { organizations } from "./schema/organizations";
import { roles, userRoles, users } from "./schema/identity";
import { issuePasswordResetToken } from "../domains/identity/services/password.service";
import { env } from "../lib/env";

async function main() {
  const [fullName, email] = process.argv.slice(2);
  if (!fullName || !email) {
    console.error('Uso: npx tsx src/db/bootstrap-admin.ts "Nombre Completo" correo@ejemplo.com');
    process.exit(1);
  }

  const [org] =
    (await db.insert(organizations).values({ name: "Delta Seguros", slug: "delta" }).onConflictDoNothing({ target: organizations.slug }).returning()) ??
    [];
  const organization = org ?? (await db.select().from(organizations).where(eq(organizations.slug, "delta")))[0];
  if (!organization) throw new Error("No se pudo crear ni encontrar la organización Delta Seguros");

  const [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  if (existing) {
    console.log(`Ya existe un usuario con ese correo (${existing.id}) — no se creó uno nuevo.`);
    const resetToken = await issuePasswordResetToken(db, existing.id);
    console.log(`Link para crear/recuperar la clave:\n${env.APP_URL}/crear-clave/${resetToken}`);
    process.exit(0);
  }

  const [adminRole] = await db.select().from(roles).where(eq(roles.code, "ADMIN"));
  if (!adminRole) throw new Error("Rol ADMIN no sembrado — corré npm run db:seed primero");

  const [user] = await db
    .insert(users)
    .values({
      organizationId: organization.id,
      email: email.toLowerCase(),
      fullName,
      provider: "credentials",
      branches: ["AUTOS", "SALUD"],
    })
    .returning();

  await db.insert(userRoles).values({ organizationId: organization.id, userId: user.id, roleId: adminRole.id });

  const resetToken = await issuePasswordResetToken(db, user.id);
  console.log(`Usuario ADMIN creado: ${user.email} (${user.id})`);
  console.log(`Link para crear la clave (vence en 24h):\n${env.APP_URL}/crear-clave/${resetToken}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
