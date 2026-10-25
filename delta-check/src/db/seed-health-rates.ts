/**
 * Tarifas de Salud de una organización desde reference-data/salud_tarifas.json
 * (generado por reference-data/extract_salud_from_excel.py a partir del
 * cotizador .xlsm de Delta). Reemplaza las tablas de Salud existentes, así que
 * se puede volver a correr cada vez que las aseguradoras actualizan tarifas.
 *
 * Uso: npm run db:seed:salud
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./index";
import { healthRateRules, insurers, rateTables } from "./schema/catalog";
import { organizations } from "./schema/organizations";

type HealthRateRow = {
  insurerCode: string;
  planCode: string;
  relation: "TITULAR" | "DEPENDIENTE";
  ageMin: number;
  ageMax: number;
  gender: "MASCULINO" | "FEMENINO" | null;
  region: "COSTA" | "SIERRA" | "AUSTRO" | null;
  premium: number;
};

const BATCH = 1000;

export async function seedHealthRates(organizationId: string, validFrom = new Date().toISOString().slice(0, 10)) {
  const rows: HealthRateRow[] = JSON.parse(
    readFileSync(join(process.cwd(), "..", "reference-data", "salud_tarifas.json"), "utf-8"),
  );

  const healthInsurers = await db.select().from(insurers).where(eq(insurers.branch, "SALUD"));
  const insurerByCode = new Map(healthInsurers.map((i) => [i.code, i]));

  await db.transaction(async (tx) => {
    const oldTables = await tx
      .select({ id: rateTables.id })
      .from(rateTables)
      .where(and(eq(rateTables.organizationId, organizationId), eq(rateTables.branch, "SALUD")));
    if (oldTables.length) {
      const ids = oldTables.map((t) => t.id);
      await tx.delete(healthRateRules).where(inArray(healthRateRules.rateTableId, ids));
      await tx.delete(rateTables).where(inArray(rateTables.id, ids));
    }

    for (const code of new Set(rows.map((r) => r.insurerCode))) {
      const insurer = insurerByCode.get(code);
      if (!insurer) throw new Error(`Aseguradora ${code} no existe — corré primero: npm run db:seed`);

      const [table] = await tx
        .insert(rateTables)
        .values({ organizationId, insurerId: insurer.id, branch: "SALUD", visibility: "PRIVATE", isConfirmed: true, validFrom })
        .returning();

      const values = rows
        .filter((r) => r.insurerCode === code)
        .map((r) => ({
          rateTableId: table.id,
          planCode: r.planCode,
          relation: r.relation,
          ageMin: r.ageMin,
          ageMax: r.ageMax,
          gender: r.gender,
          region: r.region,
          premiumCents: Math.round(r.premium * 100),
        }));
      for (let i = 0; i < values.length; i += BATCH) {
        await tx.insert(healthRateRules).values(values.slice(i, i + BATCH));
      }
      console.log(`  ${code}: ${values.length} reglas de tarifa`);
    }
  });
}

async function main() {
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, "delta"));
  if (!org) throw new Error("No existe la organización delta — corré primero: npm run db:seed:dev");
  await seedHealthRates(org.id);
  console.log("Listo.");
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
