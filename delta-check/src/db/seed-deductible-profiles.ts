/**
 * Siembra `insurer_deductible_profiles` desde los valores hardcodeados de
 * `insurer-offer-profiles.ts` — deja la tabla con el mismo valor que ya se
 * usa hoy (cero cambio visible), lista para editarse desde /admin/deducibles
 * en vez de por código. Idempotente: no pisa una fila que ya exista (si
 * alguien ya editó algo desde el admin, esto no la revierte).
 *
 * Uso: npm run db:seed:deducibles
 */
import { pathToFileURL } from "node:url";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { insurers, insurerDeductibleProfiles } from "./schema/catalog";
import { organizations } from "./schema/organizations";
import { INSURER_OFFER_PROFILES } from "../domains/quoting/offer/insurer-offer-profiles";

export async function seedDeductibleProfiles(organizationId: string) {
  const autoInsurers = await db.select().from(insurers).where(eq(insurers.branch, "AUTOS"));

  for (const insurer of autoInsurers) {
    const profile = INSURER_OFFER_PROFILES[insurer.code];
    if (!profile) continue;
    await db
      .insert(insurerDeductibleProfiles)
      .values({
        organizationId,
        insurerId: insurer.id,
        partialDefault: profile.defaults.partialDeductible,
        totalLossDefault: profile.defaults.totalLossDeductible,
        partialOptions: profile.options.partialDeductible ?? [],
        partialParts: profile.options.partialDeductibleParts ?? null,
        totalLossOptions: profile.options.totalLossDeductible ?? [],
      })
      .onConflictDoNothing({ target: [insurerDeductibleProfiles.organizationId, insurerDeductibleProfiles.insurerId] });
    console.log(`  ${insurer.code}: sembrado`);
  }
}

async function main() {
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, "delta"));
  if (!org) throw new Error("No existe la organización delta — corré primero: npm run db:seed:dev");
  await seedDeductibleProfiles(org.id);
  console.log("Listo.");
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
