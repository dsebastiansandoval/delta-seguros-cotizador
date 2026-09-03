/**
 * Seed de la organización Delta + usuario de desarrollo + tasas reales de
 * Latina y Cóndor. Separado de seed.ts porque esto SÍ crea un tenant y un
 * usuario de login de prueba — seed.ts se mantiene seguro para correr en
 * cualquier entorno (incluido producción), esto no.
 *
 * Uso: npm run db:seed:dev
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { organizations } from "./schema/organizations";
import { roles, userRoles, users } from "./schema/identity";
import { insurers } from "./schema/catalog";
import { healthRateRules, rateRules, rateTables } from "./schema/catalog";

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

type SigmaRow = { age: number; region: "COSTA" | "SIERRA" | "AUSTRO"; deductible: string; premium: number };
type HumanaRow = {
  ageMin: number;
  ageMax: number;
  product: string;
  gender: "MASCULINO" | "FEMENINO";
  premium: number;
};
type SimpleHealthRow = {
  planCode: string;
  ageMin: number;
  ageMax: number;
  gender: "MASCULINO" | "FEMENINO";
  deductibleCode?: string | null;
  premium: number;
};

/**
 * BMI (Sigma) y Humana — exportados directo del Excel a JSON con un script
 * de Python (reference-data/salud_bmi_sigma.json, salud_humana.json) en vez
 * de transcritos a mano: son ~2.000 puntos de dato, demasiado para copiar
 * sin error. Ver EXCEL-AUDIT.md §2.3 para el resto de aseguradoras
 * (Confiamed/SaludSA/Pro/VB) — rango confirmado por fórmula, pero todavía
 * sin sembrar.
 */
async function seedHealthRates(organizationId: string) {
  const referenceDataDir = join(process.cwd(), "..", "reference-data");

  const [bmi] = await db.select().from(insurers).where(eq(insurers.code, "BMI"));
  const [humana] = await db.select().from(insurers).where(eq(insurers.code, "HUMANA"));
  if (!bmi || !humana) throw new Error("Corré primero: npm run db:seed");

  // --- BMI / Sigma ---
  const sigmaRows: SigmaRow[] = JSON.parse(
    readFileSync(join(referenceDataDir, "salud_bmi_sigma.json"), "utf-8"),
  );
  const [bmiTable] = await db
    .insert(rateTables)
    .values({ organizationId, insurerId: bmi.id, branch: "SALUD", visibility: "PRIVATE", isConfirmed: true, validFrom: "2026-01-01" })
    .returning();

  await db.insert(healthRateRules).values(
    sigmaRows.map((r) => ({
      rateTableId: bmiTable.id,
      planCode: "SIGMA",
      ageMin: r.age,
      ageMax: r.age, // edad individual, no rango — EXCEL-AUDIT.md §2.3
      region: r.region,
      deductibleCode: r.deductible,
      premiumCents: Math.round(r.premium * 100),
    })),
  );
  console.log(`  BMI (Sigma): ${sigmaRows.length} reglas de tarifa sembradas`);

  // --- Humana ---
  const humanaRows: HumanaRow[] = JSON.parse(
    readFileSync(join(referenceDataDir, "salud_humana.json"), "utf-8"),
  );
  const [humanaTable] = await db
    .insert(rateTables)
    .values({ organizationId, insurerId: humana.id, branch: "SALUD", visibility: "PRIVATE", isConfirmed: true, validFrom: "2026-01-01" })
    .returning();

  await db.insert(healthRateRules).values(
    humanaRows.map((r) => ({
      rateTableId: humanaTable.id,
      planCode: r.product,
      ageMin: r.ageMin,
      ageMax: r.ageMax,
      gender: r.gender,
      premiumCents: Math.round(r.premium * 100),
    })),
  );
  console.log(`  Humana: ${humanaRows.length} reglas de tarifa sembradas`);
}

/**
 * Confiamed, SaludSA, Pro y VB — mismo patrón que BMI/Humana: exportados del
 * Excel a JSON con Python (reference-data/salud_{confiamed,saludsa,pro,vb}.json),
 * rango confirmado por la propia fórmula VLOOKUP de cada hoja de aseguradora
 * (EXCEL-AUDIT.md §2.3), no por posición/rótulo cercano. Con esto se completa
 * la Fase 2: de las 8 aseguradoras de Salud, 7 tienen motor de tarifa real
 * sembrado — solo Bupa queda 100% manual (cero fórmulas VLOOKUP en su hoja).
 */
async function seedRemainingHealthInsurers(organizationId: string) {
  const referenceDataDir = join(process.cwd(), "..", "reference-data");

  const files: Array<{ code: string; file: string }> = [
    { code: "CONFIAMED", file: "salud_confiamed.json" },
    { code: "SALUDSA", file: "salud_saludsa.json" },
    { code: "PRO", file: "salud_pro.json" },
    { code: "VB", file: "salud_vb.json" },
  ];

  for (const { code, file } of files) {
    const [insurer] = await db.select().from(insurers).where(eq(insurers.code, code));
    if (!insurer) throw new Error(`Corré primero: npm run db:seed (falta ${code})`);

    const rows: SimpleHealthRow[] = JSON.parse(
      readFileSync(join(referenceDataDir, file), "utf-8"),
    );

    const [table] = await db
      .insert(rateTables)
      .values({
        organizationId,
        insurerId: insurer.id,
        branch: "SALUD",
        visibility: "PRIVATE",
        isConfirmed: true,
        validFrom: "2026-01-01",
      })
      .returning();

    await db.insert(healthRateRules).values(
      rows.map((r) => ({
        rateTableId: table.id,
        planCode: r.planCode,
        ageMin: r.ageMin,
        ageMax: r.ageMax,
        gender: r.gender,
        deductibleCode: r.deductibleCode ?? null,
        premiumCents: Math.round(r.premium * 100),
      })),
    );

    console.log(`  ${code}: ${rows.length} reglas de tarifa sembradas`);
  }
}

/**
 * Salud genérica (código de aseguradora "SALUD") — la más compleja de las 8:
 * 9 productos (Star/Sky/Pro con sus variantes de deducible), cada uno con
 * DOS tablas separadas en el Excel: adultos (edad>=18, filas 181-187 de su
 * bloque — las filas 179-180 del mismo bloque son datos muertos, la propia
 * fórmula VLOOKUP nunca las lee porque <18 siempre usa la otra tabla) y
 * niños (edad<18, filas 190-191, en un bloque de columnas aparte — para el
 * producto SKY_70_PLUS_200 ese bloque de niños existe en la hoja pero está
 * completamente vacío, así que no se siembra esa combinación, igual que
 * Practihumana 50 en Humana). Ver EXCEL-AUDIT.md §2.3 para el detalle de
 * cómo se corrigió la atribución de este bloque (antes confundido con
 * SaludSA por rótulos cercanos, no por fórmula).
 */
async function seedSaludGenerica(organizationId: string) {
  const referenceDataDir = join(process.cwd(), "..", "reference-data");
  const [insurer] = await db.select().from(insurers).where(eq(insurers.code, "SALUD"));
  if (!insurer) throw new Error("Corré primero: npm run db:seed (falta SALUD)");

  const rows: SimpleHealthRow[] = JSON.parse(
    readFileSync(join(referenceDataDir, "salud_generica.json"), "utf-8"),
  );

  const [table] = await db
    .insert(rateTables)
    .values({
      organizationId,
      insurerId: insurer.id,
      branch: "SALUD",
      visibility: "PRIVATE",
      isConfirmed: true,
      validFrom: "2026-01-01",
    })
    .returning();

  await db.insert(healthRateRules).values(
    rows.map((r) => ({
      rateTableId: table.id,
      planCode: r.planCode,
      ageMin: r.ageMin,
      ageMax: r.ageMax,
      gender: r.gender,
      deductibleCode: r.deductibleCode ?? null,
      premiumCents: Math.round(r.premium * 100),
    })),
  );

  console.log(`  SALUD (genérica): ${rows.length} reglas de tarifa sembradas`);
}

async function main() {
  console.log("Sembrando organización Delta Seguros…");
  const org = await seedDeltaOrganization();

  console.log(`Sembrando usuario de desarrollo (${DEV_USER_EMAIL})…`);
  await seedDevUser(org.id);

  console.log("Sembrando tasas reales de Latina y Cóndor…");
  await seedLatinaAndCondorRates(org.id);

  console.log("Sembrando tarifas reales de Salud (BMI + Humana)…");
  await seedHealthRates(org.id);

  console.log("Sembrando tarifas reales de Salud (Confiamed, SaludSA, Pro, VB)…");
  await seedRemainingHealthInsurers(org.id);

  console.log("Sembrando tarifas reales de Salud (genérica)…");
  await seedSaludGenerica(org.id);

  console.log("Listo. Organización:", org.id);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
