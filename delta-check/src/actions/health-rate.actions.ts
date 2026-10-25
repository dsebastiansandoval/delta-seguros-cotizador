"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { withOrganization } from "@/db";
import { insurers } from "@/db/schema/catalog";
import { parseHealthRateCsv } from "@/domains/health/services/health-rate-csv";
import { healthRateAdminService, ratedPlanCodes } from "@/domains/health/services/health-rate-admin.service";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { audit } from "@/domains/shared/audit";
import type { ActionResult } from "./quote.actions";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function getHealthRateOverview() {
  const session = await requirePermission("rate:edit");
  return withOrganization(session.organizationId, (tx) => healthRateAdminService.overview(tx));
}

export type HealthRateUploadResult = { insurerName: string; rules: number; plans: number; validFrom: string; replaced: boolean };

export async function uploadHealthRates(
  _prevState: ActionResult<HealthRateUploadResult> | null,
  formData: FormData,
): Promise<ActionResult<HealthRateUploadResult>> {
  const session = await requirePermission("rate:edit");

  const insurerId = String(formData.get("insurerId") ?? "");
  const validFrom = String(formData.get("validFrom") ?? "");
  const file = formData.get("file");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(validFrom)) return { ok: false, errors: { form: ["Ingresa la fecha de vigencia"] } };
  if (!(file instanceof File) || file.size === 0) return { ok: false, errors: { form: ["Selecciona el archivo CSV"] } };
  if (file.size > MAX_FILE_BYTES) return { ok: false, errors: { form: ["El archivo pesa más de 5 MB"] } };

  return withOrganization(session.organizationId, async (tx) => {
    const [insurer] = await tx.select().from(insurers).where(eq(insurers.id, insurerId));
    if (!insurer || insurer.branch !== "SALUD") return { ok: false, errors: { form: ["Aseguradora inválida"] } };

    const parsed = parseHealthRateCsv(await file.text(), { validPlanCodes: ratedPlanCodes(insurer.code) });
    if (parsed.errors.length) return { ok: false, errors: { form: parsed.errors } };

    const { tableId, replaced } = await healthRateAdminService.replace(tx, session.organizationId, session.userId, {
      insurerId,
      validFrom,
      rows: parsed.rows,
    });
    const plans = new Set(parsed.rows.map((r) => r.planCode)).size;
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "health_rates.uploaded",
      entityType: "rate_tables",
      entityId: tableId,
      metadata: { insurer: insurer.code, validFrom, rules: parsed.rows.length, plans, replaced, fileName: file.name },
    });

    revalidatePath("/admin/tarifas-salud");
    return { ok: true, value: { insurerName: insurer.name, rules: parsed.rows.length, plans, validFrom, replaced } };
  });
}
