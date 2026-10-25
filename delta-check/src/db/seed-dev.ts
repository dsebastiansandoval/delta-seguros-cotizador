/**
 * Seed de la organización Delta + usuario de desarrollo + tarifas de Salud.
 * Separado de seed.ts porque esto SÍ crea un tenant y un
 * usuario de login de prueba — seed.ts se mantiene seguro para correr en
 * cualquier entorno (incluido producción), esto no.
 *
 * Uso: npm run db:seed:dev
 */
import { eq } from "drizzle-orm";
import { db } from "./index";
import { organizations } from "./schema/organizations";
import { roles, userRoles, users } from "./schema/identity";
import { quoteSources, quoteExecutives } from "./schema/clients";
import { seedHealthRates } from "./seed-health-rates";

const DEV_USER_EMAIL = "dev@deltaseguros.local";

async function seedDeltaOrganization() {
  const [org] = await db
    .insert(organizations)
    .values({ name: "Delta Seguros", slug: "delta" })
    .onConflictDoNothing({ target: organizations.slug })
    .returning();

  if (org) return org;
  const [existing] = await db.select().from(organizations).where(eq(organizations.slug, "delta"));
  return existing;
}

async function seedDevUser(organizationId: string) {
  const [existingUser] = await db.select().from(users).where(eq(users.email, DEV_USER_EMAIL));

  const user =
    existingUser ??
    (
      await db
        .insert(users)
        .values({
          organizationId,
          email: DEV_USER_EMAIL,
          fullName: "Agente de prueba",
          provider: "email",
        })
        .returning()
    )[0];

  // ADMIN, no AGENTE — este es el único usuario de login local (demos,
  // pruebas manuales), y un AGENTE no tiene quote:read_all/commission:read_all/
  // etc., así que se queda afuera del dashboard y de cartera/comisiones de
  // otros agentes. No hay todavía una pantalla para crear más usuarios ni
  // asignar roles, así que un solo login con acceso completo es lo único
  // práctico hasta que exista esa pantalla.
  const [adminRole] = await db.select().from(roles).where(eq(roles.code, "ADMIN"));
  if (adminRole) {
    await db
      .insert(userRoles)
      .values({ organizationId, userId: user.id, roleId: adminRole.id })
      .onConflictDoNothing();
  }

  return user;
}

/**
 * FUENTE real (`INFO GENERAL!T15:T43` de COTIZADOR DELTA.xlsm — verificado
 * como el rango exacto de la validación de datos de `DATOS VH!H14`, no el
 * segundo bloque `T50:T62` con el mismo encabezado que ninguna validación
 * usa). 29 nombres, orden tal cual el Excel.
 */
const FUENTES = [
  "CATALINA ALVEAR",
  "CRISTIAN ESCOBAR",
  "DANIEL REINOSO",
  "DIANA FLORES",
  "DIEGO ENDARA",
  "DIEGO VIERA",
  "FERNANDO CABRERA",
  "FERNANDO LEON",
  "FRANCISCO VILLASIS",
  "GABRIELA HIDALGO",
  "ISAAC GUACHAMIN",
  "JEAN HERRERA",
  "JENNY AGUIRRE",
  "JORGE LAMIÑO",
  "JOSE CORDOVA",
  "JOSE LUIS PADILLA",
  "JOSE LUIS RUIZ",
  "JOSEFINA REGATO",
  "JUAN CARLOS MONTENEGRO",
  "LEADS FERNANDO CABRERA",
  "LEADS RICHARD ESCOBAR",
  "LEADS STEFY",
  "MANUEL LLUMIQUINGA",
  "NICOLAS MALDONADO",
  "PABLO MARTINEZ",
  "PAOLA MORA",
  "PATY QUIROZ",
  "RICHARD ESCOBAR",
  "SARITA GALLEGOS",
];

async function seedQuoteSources(organizationId: string) {
  await db
    .insert(quoteSources)
    .values(FUENTES.map((name, i) => ({ organizationId, name, displayOrder: i })))
    .onConflictDoNothing();
  console.log(`  FUENTE: ${FUENTES.length} nombres sembrados`);
}

/**
 * EJECUTIVO real (`INFO GENERAL!Y15:Y19` — la lista de la validación de
 * datos real de `DATOS VH!D8`). 5 nombres, distinto de FUENTE.
 */
const EJECUTIVOS = ["DIEGO VIERA", "FERNANDO CABRERA", "JORGE LAMIÑO", "RICHARD ESCOBAR", "STEFANY LOPEZ"];

async function seedQuoteExecutives(organizationId: string) {
  await db
    .insert(quoteExecutives)
    .values(EJECUTIVOS.map((name, i) => ({ organizationId, name, displayOrder: i })))
    .onConflictDoNothing();
  console.log(`  EJECUTIVO: ${EJECUTIVOS.length} nombres sembrados`);
}

async function main() {
  console.log("Sembrando organización Delta Seguros…");
  const org = await seedDeltaOrganization();

  console.log(`Sembrando usuario de desarrollo (${DEV_USER_EMAIL})…`);
  await seedDevUser(org.id);

  console.log("Sembrando tarifas de Salud (reference-data/salud_tarifas.json)…");
  await seedHealthRates(org.id);

  console.log("Sembrando FUENTE (INFO GENERAL!T15:T43)…");
  await seedQuoteSources(org.id);

  console.log("Sembrando EJECUTIVO (INFO GENERAL!Y15:Y19)…");
  await seedQuoteExecutives(org.id);

  console.log("Listo. Organización:", org.id);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
