"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withOrganization } from "@/db";
import { insurers } from "@/db/schema/catalog";
import { INSURER_OFFER_PROFILES } from "@/domains/quoting/offer/insurer-offer-profiles";
import { loadDeductibleOverrides, upsertDeductibleOverride } from "@/domains/quoting/offer/deductible-override.repo";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { audit } from "@/domains/shared/audit";
import type { ActionResult } from "./quote.actions";

export type DeductibleProfileRow = {
  insurerId: string;
  code: string;
  name: string;
  partialDefault: string;
  totalLossDefault: string;
  partialOptions: string[];
  partialParts: { vs: string[]; va: string[]; min: string[] } | null;
  totalLossOptions: string[];
  isOverridden: boolean;
};

/** Perfil vigente por aseguradora de Autos: override de /admin/deducibles si existe, si no el valor del Excel. */
export async function getDeductibleProfiles(): Promise<DeductibleProfileRow[]> {
  const session = await requirePermission("rate:edit");
  return withOrganization(session.organizationId, async (tx) => {
    const autoInsurers = await tx
      .select({ id: insurers.id, code: insurers.code, name: insurers.name })
      .from(insurers)
      .where(eq(insurers.branch, "AUTOS"))
      .orderBy(asc(insurers.name));
    const overrides = await loadDeductibleOverrides(tx);

    return autoInsurers
      .map((insurer) => {
        const hardcoded = INSURER_OFFER_PROFILES[insurer.code];
        if (!hardcoded) return null;
        const override = overrides.get(insurer.id);
        return {
          insurerId: insurer.id,
          code: insurer.code,
          name: insurer.name,
          partialDefault: override?.partialDefault ?? hardcoded.defaults.partialDeductible,
          totalLossDefault: override?.totalLossDefault ?? hardcoded.defaults.totalLossDeductible,
          partialOptions: override?.partialOptions ?? hardcoded.options.partialDeductible ?? [],
          partialParts: override?.partialParts ?? hardcoded.options.partialDeductibleParts ?? null,
          totalLossOptions: override?.totalLossOptions ?? hardcoded.options.totalLossDeductible ?? [],
          isOverridden: Boolean(override),
        } satisfies DeductibleProfileRow;
      })
      .filter((r): r is DeductibleProfileRow => r !== null);
  });
}

const nonEmptyTrimmed = z.string().transform((s) => s.trim()).pipe(z.string().min(1));

const updateSchema = z.object({
  insurerId: z.string().uuid(),
  partialDefault: nonEmptyTrimmed,
  totalLossDefault: nonEmptyTrimmed,
  // Vacío cuando la aseguradora usa partialParts (3 fragmentos combinables) en vez de un menú de frases.
  partialOptions: z.array(nonEmptyTrimmed),
  totalLossOptions: z.array(nonEmptyTrimmed).min(1),
  partialParts: z
    .object({
      vs: z.array(nonEmptyTrimmed).min(1),
      va: z.array(nonEmptyTrimmed).min(1),
      min: z.array(nonEmptyTrimmed).min(1),
    })
    .nullable(),
});

function readList(formData: FormData, prefix: string): string[] {
  return formData
    .getAll(prefix)
    .map((v) => String(v).trim())
    .filter(Boolean);
}

export async function updateDeductibleProfile(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("rate:edit");

  const usesParts = formData.get("usesParts") === "1";
  const parsed = updateSchema.safeParse({
    insurerId: formData.get("insurerId"),
    partialDefault: formData.get("partialDefault"),
    totalLossDefault: formData.get("totalLossDefault"),
    partialOptions: readList(formData, "partialOptions"),
    totalLossOptions: readList(formData, "totalLossOptions"),
    partialParts: usesParts
      ? {
          vs: readList(formData, "partsVs"),
          va: readList(formData, "partsVa"),
          min: readList(formData, "partsMin"),
        }
      : null,
  });
  if (!parsed.success) {
    return { ok: false, errors: { form: [parsed.error.issues[0]?.message ?? "Datos inválidos"] } };
  }
  const input = parsed.data;
  if (!usesParts && input.partialOptions.length === 0) {
    return { ok: false, errors: { form: ["Agrega al menos una opción de deducible parcial"] } };
  }
  if (!usesParts && !input.partialOptions.includes(input.partialDefault)) {
    return { ok: false, errors: { form: ["El deducible parcial por defecto debe estar en la lista de opciones"] } };
  }
  if (!input.totalLossOptions.includes(input.totalLossDefault)) {
    return { ok: false, errors: { form: ["La pérdida total por defecto debe estar en la lista de opciones"] } };
  }

  return withOrganization(session.organizationId, async (tx) => {
    const [insurer] = await tx.select().from(insurers).where(eq(insurers.id, input.insurerId));
    if (!insurer || insurer.branch !== "AUTOS") return { ok: false, errors: { form: ["Aseguradora inválida"] } };

    await upsertDeductibleOverride(tx, session.organizationId, {
      insurerId: input.insurerId,
      partialDefault: input.partialDefault,
      totalLossDefault: input.totalLossDefault,
      partialOptions: usesParts ? [] : input.partialOptions,
      partialParts: usesParts ? input.partialParts : null,
      totalLossOptions: input.totalLossOptions,
      updatedBy: session.userId,
    });
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "deductible_profile.update",
      entityType: "insurer_deductible_profile",
      entityId: input.insurerId,
    });
    revalidatePath("/admin/deducibles");
    return { ok: true, value: undefined };
  });
}
