"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withOrganization } from "@/db";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { claimService } from "@/domains/policies/services/claim.service";
import { addClaimNoteSchema, reportClaimSchema, updateClaimStatusSchema } from "@/domains/policies/schemas/policy.schema";
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
    await claimService.updateStatus(tx, session.organizationId, parsed.data.claimId, parsed.data.status, session.userId);
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
  revalidatePath(`/siniestros/${parsed.data.claimId}`);
  return { ok: true, value: undefined };
}

/** Novedad escrita a mano — el "chat"/historial del siniestro que hoy se lleva en un Excel compartido. */
export async function addClaimNote(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("claim:manage");
  await rateLimit(`claim-note:${session.userId}`, { limit: 60, window: "1 m" });

  const parsed = addClaimNoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  await withOrganization(session.organizationId, async (tx) => {
    const event = await claimService.addNote(tx, session.organizationId, parsed.data.claimId, session.userId, parsed.data.note);
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "claim.note_added",
      entityType: "claim_events",
      entityId: event.id,
    });
  });

  revalidatePath(`/siniestros/${parsed.data.claimId}`);
  return { ok: true, value: undefined };
}

export async function listClaims() {
  const session = await requirePermission("quote:read");
  return withOrganization(session.organizationId, (tx) => claimService.list(tx, [...session.branches]));
}

/** Detalle + historial de novedades, para /siniestros/[claimId] — mismo patrón de chequeo de ramo que getPolicyDetail. */
export async function getClaimDetail(claimId: string) {
  const session = await requirePermission("quote:read");
  const detail = await withOrganization(session.organizationId, (tx) => claimService.getDetail(tx, claimId));
  return detail && session.branches.has(detail.policyBranch) ? detail : null;
}
