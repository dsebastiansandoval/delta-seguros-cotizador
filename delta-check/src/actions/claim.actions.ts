"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withOrganization } from "@/db";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { claimService } from "@/domains/policies/services/claim.service";
import { reportClaimSchema, updateClaimStatusSchema } from "@/domains/policies/schemas/policy.schema";
import { audit } from "@/domains/shared/audit";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "./quote.actions";

export async function reportClaim(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("claim:manage");
  await rateLimit(`claim:${session.userId}`, { limit: 30, window: "1 m" });

  const parsed = reportClaimSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  await withOrganization(session.organizationId, async (tx) => {
    const claim = await claimService.report(tx, session.organizationId, parsed.data);
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "claim.reported",
      entityType: "claims",
      entityId: claim.id,
    });
  });

  revalidatePath("/siniestros");
  redirect("/siniestros");
}

export async function updateClaimStatus(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("claim:manage");

  const parsed = updateClaimStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  await withOrganization(session.organizationId, async (tx) => {
    await claimService.updateStatus(tx, parsed.data.claimId, parsed.data.status);
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "claim.status_updated",
      entityType: "claims",
      entityId: parsed.data.claimId,
      metadata: { status: parsed.data.status },
    });
  });

  revalidatePath("/siniestros");
  return { ok: true, value: undefined };
}

export async function listClaims() {
  const session = await requirePermission("quote:read");
  return withOrganization(session.organizationId, (tx) => claimService.list(tx, [...session.branches]));
}
