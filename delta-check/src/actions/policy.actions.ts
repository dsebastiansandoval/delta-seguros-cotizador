"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withOrganization } from "@/db";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { PolicyStateError, policyService } from "@/domains/policies/services/policy.service";
import { quoteOptions, quoteRisks, quotes } from "@/db/schema/quoting";
import { insurers } from "@/db/schema/catalog";
import { clients } from "@/db/schema/clients";
import {
  cancelPolicySchema,
  confirmCancellationSchema,
  emitPolicySchema,
  generateInstallmentsSchema,
  markInstallmentPaidSchema,
  markPolicyPaidSchema,
  setIssueStatusSchema,
  setPolicyNumberSchema,
} from "@/domains/policies/schemas/policy.schema";
import { dollarsToCents } from "@/domains/shared/money";
import { audit } from "@/domains/shared/audit";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "./quote.actions";

/**
 * Emite una póliza desde una opción de cotización ya cotizada (COTIZADO).
 * Crea también la comisión pendiente en la misma transacción — ver
 * policyService.emitPolicy y EXCEL-AUDIT.md §4 (hallazgo confirmado en la
 * macro ALTA_EN_BASE_PENDIENTE).
 */
export async function emitPolicy(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("policy:manage");
  await rateLimit(`policy:${session.userId}`, { limit: 30, window: "1 m" });

  const parsed = emitPolicySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }

  const policyId = await withOrganization(session.organizationId, async (tx) => {
    const { policy } = await policyService.emitPolicy(tx, {
      organizationId: session.organizationId,
      agentId: session.userId,
      input: parsed.data,
    });

    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "policy.emitted",
      entityType: "policies",
      entityId: policy.id,
    });

    return policy.id;
  });

  revalidatePath("/cartera");
  redirect(`/cartera/${policyId}`);
}

export async function setPolicyNumber(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("policy:manage");

  const parsed = setPolicyNumberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  await withOrganization(session.organizationId, async (tx) => {
    await policyService.setPolicyNumber(
      tx,
      session.organizationId,
      session.userId,
      parsed.data.policyId,
      parsed.data.policyNumber,
    );
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "policy.number_set",
      entityType: "policies",
      entityId: parsed.data.policyId,
    });
  });

  revalidatePath(`/cartera/${parsed.data.policyId}`);
  revalidatePath("/cartera");
  return { ok: true, value: undefined };
}

export async function markPolicyPaid(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("policy:manage");

  const parsed = markPolicyPaidSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  await withOrganization(session.organizationId, async (tx) => {
    await policyService.markPaid(tx, session.organizationId, session.userId, parsed.data.policyId);
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "policy.payment_received",
      entityType: "policies",
      entityId: parsed.data.policyId,
    });
  });

  revalidatePath(`/cartera/${parsed.data.policyId}`);
  revalidatePath("/cartera");
  return { ok: true, value: undefined };
}

export async function cancelPolicy(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("policy:manage");

  const parsed = cancelPolicySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  try {
    await withOrganization(session.organizationId, async (tx) => {
      await policyService.cancel(tx, session.organizationId, session.userId, parsed.data.policyId, {
        reason: parsed.data.cancellationReason,
        cancelledPremiumCents: dollarsToCents(parsed.data.cancelledPremiumDollars),
        confirmed: parsed.data.confirmed,
      });
      await audit(tx, {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "policy.cancelled",
        entityType: "policies",
        entityId: parsed.data.policyId,
        metadata: { confirmed: parsed.data.confirmed },
      });
    });
  } catch (error) {
    if (error instanceof PolicyStateError) return { ok: false, errors: { form: [error.message] } };
    throw error;
  }

  revalidatePath(`/cartera/${parsed.data.policyId}`);
  revalidatePath("/cartera");
  revalidatePath("/comisiones");
  return { ok: true, value: undefined };
}

export async function confirmCancellation(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("policy:manage");

  const parsed = confirmCancellationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  try {
    await withOrganization(session.organizationId, async (tx) => {
      await policyService.confirmCancellation(tx, session.organizationId, session.userId, parsed.data.policyId);
      await audit(tx, {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "policy.cancellation_confirmed",
        entityType: "policies",
        entityId: parsed.data.policyId,
      });
    });
  } catch (error) {
    if (error instanceof PolicyStateError) return { ok: false, errors: { form: [error.message] } };
    throw error;
  }

  revalidatePath(`/cartera/${parsed.data.policyId}`);
  revalidatePath("/cartera");
  return { ok: true, value: undefined };
}

export async function setIssueStatus(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("policy:manage");

  const parsed = setIssueStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  try {
    await withOrganization(session.organizationId, async (tx) => {
      await policyService.setIssueStatus(
        tx,
        session.organizationId,
        session.userId,
        parsed.data.policyId,
        parsed.data.issueStatus,
      );
      await audit(tx, {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "policy.issue_status_set",
        entityType: "policies",
        entityId: parsed.data.policyId,
        metadata: { issueStatus: parsed.data.issueStatus },
      });
    });
  } catch (error) {
    if (error instanceof PolicyStateError) return { ok: false, errors: { form: [error.message] } };
    throw error;
  }

  revalidatePath(`/cartera/${parsed.data.policyId}`);
  revalidatePath("/cartera");
  return { ok: true, value: undefined };
}

export async function generateInstallments(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("policy:manage");

  const parsed = generateInstallmentsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  await withOrganization(session.organizationId, async (tx) => {
    await policyService.generateInstallments(tx, session.organizationId, parsed.data.policyId, {
      count: parsed.data.count,
      totalCents: dollarsToCents(parsed.data.totalDollars),
      firstDueDate: parsed.data.firstDueDate,
    });
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "policy.installments_generated",
      entityType: "policies",
      entityId: parsed.data.policyId,
      metadata: { count: parsed.data.count },
    });
  });

  revalidatePath(`/cartera/${parsed.data.policyId}`);
  return { ok: true, value: undefined };
}

export async function markInstallmentPaid(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("policy:manage");

  const parsed = markInstallmentPaidSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  await withOrganization(session.organizationId, async (tx) => {
    await policyService.markInstallmentPaid(tx, parsed.data.installmentId);
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "policy.installment_paid",
      entityType: "policy_installments",
      entityId: parsed.data.installmentId,
    });
  });

  revalidatePath(`/cartera/${parsed.data.policyId}`);
  return { ok: true, value: undefined };
}

/** Solo las pólizas de los ramos que el usuario tiene habilitados. */
export async function listPolicies(filters?: { lifecycleStatus?: "VIGENTE" | "CANCELACION_PENDIENTE" | "CANCELADA" }) {
  const session = await requirePermission("quote:read");
  return withOrganization(session.organizationId, (tx) =>
    policyService.list(tx, { ...filters, branches: [...session.branches] }),
  );
}

export async function getPolicyDetail(policyId: string) {
  const session = await requirePermission("quote:read");
  const detail = await withOrganization(session.organizationId, (tx) => policyService.getDetail(tx, policyId));
  return detail && session.branches.has(detail.policy.branch) ? detail : null;
}

/** Contexto para el formulario de emisión — de qué cotización/cliente/aseguradora nace la póliza. */
export async function getQuoteOptionSummary(quoteOptionId: string) {
  const session = await requirePermission("policy:manage");
  return withOrganization(session.organizationId, async (tx) => {
    const [row] = await tx
      .select({
        quoteOptionId: quoteOptions.id,
        totalPremiumCents: quoteOptions.totalPremiumCents,
        planCode: quoteOptions.planCode,
        kmBracket: quoteOptions.kmBracket,
        branch: quotes.branch,
        insurerName: insurers.name,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientBusinessName: clients.businessName,
      })
      .from(quoteOptions)
      .innerJoin(quoteRisks, eq(quoteRisks.id, quoteOptions.quoteRiskId))
      .innerJoin(quotes, eq(quotes.id, quoteRisks.quoteId))
      .innerJoin(insurers, eq(insurers.id, quoteOptions.insurerId))
      .innerJoin(clients, eq(clients.id, quotes.clientId))
      .where(eq(quoteOptions.id, quoteOptionId));
    return row ?? null;
  });
}
