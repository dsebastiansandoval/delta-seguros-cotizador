"use server";

import { revalidatePath } from "next/cache";
import { withOrganization } from "@/db";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { commissionService } from "@/domains/policies/services/commission.service";
import { PolicyStateError } from "@/domains/policies/services/policy.service";
import { markCommissionDiscountedSchema, markCommissionPaidSchema, setCommissionSchema } from "@/domains/policies/schemas/policy.schema";
import { audit } from "@/domains/shared/audit";
import type { ActionResult } from "./quote.actions";

export async function setCommissionPercent(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("commission:manage");

  const parsed = setCommissionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  await withOrganization(session.organizationId, async (tx) => {
    await commissionService.setPercent(tx, parsed.data.commissionId, parsed.data.percent);
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "commission.percent_set",
      entityType: "commissions",
      entityId: parsed.data.commissionId,
      metadata: { percent: parsed.data.percent },
    });
  });

  revalidatePath("/comisiones");
  return { ok: true, value: undefined };
}

export async function markCommissionPaid(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("commission:manage");

  const parsed = markCommissionPaidSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  await withOrganization(session.organizationId, async (tx) => {
    await commissionService.markPaid(tx, parsed.data.commissionId);
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "commission.paid",
      entityType: "commissions",
      entityId: parsed.data.commissionId,
    });
  });

  revalidatePath("/comisiones");
  return { ok: true, value: undefined };
}

export async function markCommissionDiscounted(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("commission:manage");

  const parsed = markCommissionDiscountedSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  try {
    await withOrganization(session.organizationId, async (tx) => {
      await commissionService.markDiscounted(tx, parsed.data.commissionId);
      await audit(tx, {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "commission.discounted",
        entityType: "commissions",
        entityId: parsed.data.commissionId,
      });
    });
  } catch (error) {
    if (error instanceof PolicyStateError) return { ok: false, errors: { form: [error.message] } };
    throw error;
  }

  revalidatePath("/comisiones");
  if (parsed.data.policyId) revalidatePath(`/cartera/${parsed.data.policyId}`);
  return { ok: true, value: undefined };
}

export async function listCommissions() {
  const session = await requirePermission("commission:read_all");
  return withOrganization(session.organizationId, (tx) => commissionService.list(tx));
}

export async function listMyCommissions() {
  const session = await requirePermission("commission:read_own");
  return withOrganization(session.organizationId, (tx) =>
    commissionService.list(tx, { agentId: session.userId }),
  );
}
