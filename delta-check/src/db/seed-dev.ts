/**
 * Seed de la organización Delta + usuario de desarrollo + tasas reales de
 * Latina y Cóndor. Separado de seed.ts porque esto SÍ crea un tenant y un
 * usuario de login de prueba — seed.ts se mantiene seguro para correr en
 * cualquier entorno (incluido producción), esto no.
 *
 * Uso: npm run db:seed:dev
 */
import { eq } from "drizzle-orm";
import { db } from "./index";
import { organizations } from "./schema/organizations";
import { roles, userRoles, users } from "./schema/identity";
import { insurers } from "./schema/catalog";
import { rateRules, rateTables } from "./schema/catalog";

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

  const [agenteRole] = await db.select().from(roles).where(eq(roles.code, "AGENTE"));
  if (agenteRole) {
    await db
      .insert(userRoles)
      .values({ organizationId, userId: user.id, roleId: agenteRole.id })
      .onConflictDoNothing();
  }

  return user;
}

/**
 * Tasas reales extraídas de INFO GENERAL!AF7:AI28 (EXCEL-AUDIT.md §2.1,
 * reference-data/autos_tasas_latina_condor_y_cargos.csv) — no son datos de
 * ejemplo. `ageMax: null` en los tramos de Latina "riesgo1" viene del hecho
 * de que ese es el único bloque con fallback plano de 3% para 11-13 años
 * (Cóndor no lo tiene en lo que se auditó — ver EXCEL-AUDIT.md §2.1).
 */
async function seedLatinaAndCondorRates(organizationId: string) {
  const [latina] = await db.select().from(insurers).where(eq(insurers.code, "LATINA"));
  const [condor] = await db.select().from(insurers).where(eq(insurers.code, "CONDOR"));
  if (!latina || !condor) throw new Error("Corré primero: npm run db:seed");

  for (const [insurer, brackets] of [
    [
      latina,
      [
        // LIVIANO, antigüedad 0-10
        { ageMin: 0, ageMax: 10, bodyType: "LIVIANO", min: 1000000, max: 1499900, rate: 0.051 },
        { ageMin: 0, ageMax: 10, bodyType: "LIVIANO", min: 1500000, max: 1999900, rate: 0.042 },
        { ageMin: 0, ageMax: 10, bodyType: "LIVIANO", min: 2000000, max: 2499900, rate: 0.032 },
        { ageMin: 0, ageMax: 10, bodyType: "LIVIANO", min: 2500000, max: 3500000, rate: 0.025 },
        { ageMin: 0, ageMax: 10, bodyType: "LIVIANO", min: 3500000, max: 9999900, rate: 0.023 },
        // PICKUP, antigüedad 0-10
        { ageMin: 0, ageMax: 10, bodyType: "PICKUP", min: 1000000, max: 1499900, rate: 0.051 },
        { ageMin: 0, ageMax: 10, bodyType: "PICKUP", min: 1500000, max: 2999900, rate: 0.046 },
        { ageMin: 0, ageMax: 10, bodyType: "PICKUP", min: 3000000, max: 4999900, rate: 0.032 },
        { ageMin: 0, ageMax: 10, bodyType: "PICKUP", min: 5000100, max: 9999900, rate: 0.023 },
        // Antigüedad 11-13, tasa plana, cualquier tipo (INFO GENERAL!AJ7)
        { ageMin: 11, ageMax: 13, bodyType: null, min: null, max: null, rate: 0.03 },
      ],
    ],
    [
      condor,
      [
        // LIVIANO, antigüedad 0-10
        { ageMin: 0, ageMax: 10, bodyType: "LIVIANO", min: 1, max: 2000000, rate: 0.038 },
        { ageMin: 0, ageMax: 10, bodyType: "LIVIANO", min: 2000100, max: 2500000, rate: 0.031 },
        { ageMin: 0, ageMax: 10, bodyType: "LIVIANO", min: 2500100, max: 2800000, rate: 0.026 },
        { ageMin: 0, ageMax: 10, bodyType: "LIVIANO", min: 2800100, max: 99999900, rate: 0.023 },
        // PICKUP, antigüedad 0-10 — tasa única
        { ageMin: 0, ageMax: 10, bodyType: "PICKUP", min: 1, max: 99999900, rate: 0.045 },
      ],
    ],
  ] as const) {
    const [table] = await db
      .insert(rateTables)
      .values({
        organizationId,
        insurerId: insurer.id,
        branch: "AUTOS",
        visibility: "PRIVATE",
        isConfirmed: true,
        validFrom: "2026-01-01",
      })
      .returning();

    await db.insert(rateRules).values(
      brackets.map((b) => ({
        rateTableId: table.id,
        vehicleAgeMin: b.ageMin,
        vehicleAgeMax: b.ageMax,
        bodyType: b.bodyType,
        valueMinCents: b.min,
        valueMaxCents: b.max,
        ratePercent: b.rate.toFixed(5),
      })),
    );

    console.log(`  ${insurer.code}: ${brackets.length} reglas de tasa sembradas`);
  }
}

async function main() {
  console.log("Sembrando organización Delta Seguros…");
  const org = await seedDeltaOrganization();

  console.log(`Sembrando usuario de desarrollo (${DEV_USER_EMAIL})…`);
  await seedDevUser(org.id);

  console.log("Sembrando tasas reales de Latina y Cóndor…");
  await seedLatinaAndCondorRates(org.id);

  console.log("Listo. Organización:", org.id);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
