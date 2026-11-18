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
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { insurers, insurerDeductibleProfiles } from "./schema/catalog";
import { organizations } from "./schema/organizations";
import { INSURER_OFFER_PROFILES, type DeductibleParts } from "../domains/quoting/offer/insurer-offer-profiles";

export async function seedDeductibleProfiles(organizationId: string) {
  const autoInsurers = await db.select().from(insurers).where(eq(insurers.branch, "AUTOS"));

  for (const insurer of autoInsurers) {
    const profile = INSURER_OFFER_PROFILES[insurer.code];
    if (!profile) continue;

    // Acta 17-nov (ARCHITECTURE.md §37/§39): Sweaden incorporó 15% VS y 30%
    // en pérdida total. Como este seed respeta filas ya editadas desde
    // /admin/deducibles, una fila preexistente se quedaría sin las opciones
    // nuevas (el override tapa al perfil hardcodeado). Mergeamos solo esas
    // listas, sin tocar el resto de la fila ni a otras aseguradoras; es
    // idempotente.
    if (insurer.code === "SWEADEN") {
      const where = and(
        eq(insurerDeductibleProfiles.organizationId, organizationId),
        eq(insurerDeductibleProfiles.insurerId, insurer.id),
      );
      const [existing] = await db
        .select()
        .from(insurerDeductibleProfiles)
        .where(where)
        .limit(1);
      if (existing) {
        const patch: {
          partialParts?: DeductibleParts;
          totalLossOptions?: string[];
          updatedAt: Date;
        } = { updatedAt: new Date() };
        const existingParts = existing.partialParts as DeductibleParts | null | undefined;
        if (existingParts && profile.options.partialDeductibleParts) {
          const vs = Array.from(
            new Set([...existingParts.vs, ...profile.options.partialDeductibleParts.vs]),
          );
          if (vs.length !== existingParts.vs.length) {
            patch.partialParts = { ...existingParts, vs };
            console.log("  SWEADEN: agregado 15% VS al override existente");
          }
        }
        const existingTotal = (existing.totalLossOptions as string[] | null) ?? [];
        const totalLossOptions = Array.from(
          new Set([...existingTotal, ...(profile.options.totalLossDeductible ?? [])]),
        );
        if (totalLossOptions.length !== existingTotal.length) {
          patch.totalLossOptions = totalLossOptions;
          console.log("  SWEADEN: agregado 30% pérdida total al override existente");
        }
        if (patch.partialParts || patch.totalLossOptions) {
          await db.update(insurerDeductibleProfiles).set(patch).where(where);
        }
      }
    }

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
