import type { Db } from "@/db";
import { insurerDeductibleProfiles } from "@/db/schema/catalog";
import type { DeductibleParts, InsurerOfferProfile } from "./insurer-offer-profiles";

export type DeductibleOverride = {
  insurerId: string;
  partialDefault: string;
  totalLossDefault: string;
  partialOptions: string[];
  partialParts: DeductibleParts | null;
  totalLossOptions: string[];
};

/**
 * Overrides de /admin/deducibles, por insurerId. Si la tabla todavía no
 * existe en esta base (migración pendiente, igual que pasó con `ENTREGADO`
 * en Siniestros) o cualquier otro error de lectura, cae a mapa vacío — el
 * llamador ya sabe tratar "sin override" como "usa el perfil hardcodeado",
 * así que el flujo de Autos nunca se rompe por esto.
 */
export async function loadDeductibleOverrides(tx: Db): Promise<Map<string, DeductibleOverride>> {
  try {
    const rows = await tx.select().from(insurerDeductibleProfiles);
    return new Map(
      rows.map((r) => [
        r.insurerId,
        {
          insurerId: r.insurerId,
          partialDefault: r.partialDefault,
          totalLossDefault: r.totalLossDefault,
          partialOptions: (r.partialOptions as string[] | null) ?? [],
          partialParts: (r.partialParts as DeductibleParts | null) ?? null,
          totalLossOptions: (r.totalLossOptions as string[] | null) ?? [],
        },
      ]),
    );
  } catch (err) {
    console.error("loadDeductibleOverrides: fallback a perfiles hardcodeados", err);
    return new Map();
  }
}

/** Aplica el override (si existe) solo sobre defaults/options de deducible — el resto del perfil no se toca. */
export function applyDeductibleOverride(
  profile: InsurerOfferProfile | null,
  override: DeductibleOverride | undefined,
): InsurerOfferProfile | null {
  if (!profile || !override) return profile;
  return {
    ...profile,
    defaults: {
      ...profile.defaults,
      partialDeductible: override.partialDefault,
      totalLossDeductible: override.totalLossDefault,
    },
    options: {
      ...profile.options,
      partialDeductible: override.partialParts ? undefined : override.partialOptions,
      partialDeductibleParts: override.partialParts ?? undefined,
      totalLossDeductible: override.totalLossOptions,
    },
  };
}

export async function upsertDeductibleOverride(
  tx: Db,
  organizationId: string,
  input: {
    insurerId: string;
    partialDefault: string;
    totalLossDefault: string;
    partialOptions: string[];
    partialParts: DeductibleParts | null;
    totalLossOptions: string[];
    updatedBy: string;
  },
) {
  await tx
    .insert(insurerDeductibleProfiles)
    .values({ organizationId, ...input, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [insurerDeductibleProfiles.organizationId, insurerDeductibleProfiles.insurerId],
      set: {
        partialDefault: input.partialDefault,
        totalLossDefault: input.totalLossDefault,
        partialOptions: input.partialOptions,
        partialParts: input.partialParts,
        totalLossOptions: input.totalLossOptions,
        updatedBy: input.updatedBy,
        updatedAt: new Date(),
      },
    });
}

export async function listDeductibleOverrides(tx: Db) {
  return loadDeductibleOverrides(tx);
}
