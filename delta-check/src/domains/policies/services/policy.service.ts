import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { policies, policyEvents, policyInstallments, commissions } from "@/db/schema/policies";
import { quoteOptions, quoteRisks, quotes } from "@/db/schema/quoting";
import { insurers } from "@/db/schema/catalog";
import { clients } from "@/db/schema/clients";
import { applyPercent } from "@/domains/shared/money";
import type { EmitPolicyInput } from "../schemas/policy.schema";

/** Regla de estado de la póliza violada — el mensaje se muestra tal cual al usuario. */
export class PolicyStateError extends Error {}

/**
 * Orquesta cartera — emitir, cobrar, cancelar. `emitPolicy` reproduce el
 * hallazgo real de EXCEL-AUDIT.md §4: la macro `ALTA_EN_BASE_PENDIENTE`
 * escribe la póliza en `BASE_PENDIENTE` y, en el mismo paso, una fila en
 * `BASE_COMISIONES` — acá se crean póliza + comisión pendiente en la misma
 * transacción, no como dos acciones manuales separadas.
 */
export const policyService = {
  async emitPolicy(tx: Db, params: { organizationId: string; agentId: string; input: EmitPolicyInput }) {
    const { organizationId, agentId, input } = params;

    const [option] = await tx.select().from(quoteOptions).where(eq(quoteOptions.id, input.quoteOptionId));
    if (!option) throw new Error("Cotización no encontrada");
    if (!option.totalPremiumCents) {
      throw new Error("Esta opción todavía no tiene prima — no se puede emitir una póliza sin prima");
    }

    const [risk] = await tx.select().from(quoteRisks).where(eq(quoteRisks.id, option.quoteRiskId));
    if (!risk) throw new Error("Riesgo no encontrado");
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, risk.quoteId));
    if (!quote) throw new Error("Cotización no encontrada");

    const [policy] = await tx
      .insert(policies)
      .values({
        organizationId,
        quoteOptionId: option.id,
        policyNumber: input.policyNumber,
        insurerId: option.insurerId,
        clientId: quote.clientId,
        branch: quote.branch,
        issueStatus: input.policyNumber ? "EMITIDA" : input.inspectionRequired ? "INSPECCION" : "PENDIENTE",
        annexNumber: input.annexNumber,
        invoiceNumber: input.invoiceNumber,
        inspectionRequired: input.inspectionRequired,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        premiumCents: option.totalPremiumCents,
        notes: input.notes,
      })
      .returning();

    await tx.insert(policyEvents).values({
      organizationId,
      policyId: policy.id,
      eventType: "EMITTED",
      toStatus: policy.issueStatus,
      userId: agentId,
    });

    // Regla confirmada en la macro (EXCEL-AUDIT.md §4): registrar la póliza
    // crea de una vez su comisión pendiente, sin porcentaje todavía (se fija
    // a mano después — no hay tabla de comisión por aseguradora en el Excel,
    // §2.5).
    const [commission] = await tx
      .insert(commissions)
      .values({
        organizationId,
        policyId: policy.id,
        insurerId: option.insurerId,
        agentId,
        baseAmountCents: option.totalPremiumCents,
        status: "PENDIENTE",
      })
      .returning();

    return { policy, commission };
  },

  async setPolicyNumber(tx: Db, organizationId: string, userId: string, policyId: string, policyNumber: string) {
    const [updated] = await tx
      .update(policies)
      .set({ policyNumber, issueStatus: "EMITIDA", updatedAt: new Date() })
      .where(eq(policies.id, policyId))
      .returning();

    await tx.insert(policyEvents).values({
      organizationId,
      policyId,
      eventType: "POLICY_NUMBER_SET",
      toStatus: "EMITIDA",
      userId,
    });

    return updated;
  },

  async markPaid(tx: Db, organizationId: string, userId: string, policyId: string) {
    const [updated] = await tx
      .update(policies)
      .set({ paymentStatus: "PAGADO", updatedAt: new Date() })
      .where(eq(policies.id, policyId))
      .returning();

    await tx.insert(policyEvents).values({
      organizationId,
      policyId,
      eventType: "PAYMENT_RECEIVED",
      toStatus: "PAGADO",
      userId,
    });

    return updated;
  },

  /** Estatus de BASE EMISIONES mientras no hay número de póliza (EMITIDA se fija con setPolicyNumber). */
  async setIssueStatus(
    tx: Db,
    organizationId: string,
    userId: string,
    policyId: string,
    status: "PENDIENTE" | "INSPECCION" | "NO_EMITIDA",
  ) {
    const policy = await policyService.findById(tx, policyId);
    if (!policy) throw new Error("Póliza no encontrada");
    if (policy.issueStatus === "EMITIDA") throw new PolicyStateError("La póliza ya está emitida");

    const [updated] = await tx
      .update(policies)
      .set({ issueStatus: status, updatedAt: new Date() })
      .where(eq(policies.id, policyId))
      .returning();

    await tx.insert(policyEvents).values({
      organizationId,
      policyId,
      eventType: "ISSUE_STATUS_CHANGED",
      fromStatus: policy.issueStatus,
      toStatus: status,
      userId,
    });

    return updated;
  },

  /**
   * BASE_CANCELADAS — nunca se borra la póliza, se marca (mismo criterio que
   * policies.isVoid). Si la aseguradora todavía no la confirma queda en
   * CANCELACION_PENDIENTE (ESTATUS "PENDIENTE" del Excel). La comisión queda
   * por descontar sobre la prima cancelada (columna COMISION "PENDIENTE").
   */
  async cancel(
    tx: Db,
    organizationId: string,
    userId: string,
    policyId: string,
    params: { reason: string; cancelledPremiumCents: number; confirmed: boolean },
  ) {
    const policy = await policyService.findById(tx, policyId);
    if (!policy) throw new Error("Póliza no encontrada");
    if (policy.lifecycleStatus !== "VIGENTE") throw new PolicyStateError("La póliza ya está en cancelación");
    if (policy.premiumCents != null && params.cancelledPremiumCents > policy.premiumCents) {
      throw new PolicyStateError("La prima cancelada no puede ser mayor a la prima de la póliza");
    }

    const status = params.confirmed ? "CANCELADA" : "CANCELACION_PENDIENTE";
    const [updated] = await tx
      .update(policies)
      .set({
        lifecycleStatus: status,
        cancelledAt: new Date().toISOString().slice(0, 10),
        cancellationReason: params.reason,
        cancelledPremiumCents: params.cancelledPremiumCents,
        updatedAt: new Date(),
      })
      .where(eq(policies.id, policyId))
      .returning();

    const [commission] = await tx.select().from(commissions).where(eq(commissions.policyId, policyId));
    if (commission) {
      await tx
        .update(commissions)
        .set({
          discountStatus: "PENDIENTE",
          discountAmountCents:
            commission.percent != null ? applyPercent(params.cancelledPremiumCents, Number(commission.percent)) : null,
        })
        .where(eq(commissions.id, commission.id));
    }

    await tx.insert(policyEvents).values({
      organizationId,
      policyId,
      eventType: "CANCELLED",
      fromStatus: policy.lifecycleStatus,
      toStatus: status,
      notes: params.reason,
      userId,
    });

    return updated;
  },

  /** La aseguradora confirmó la cancelación: ESTATUS PENDIENTE → CANCELADA. */
  async confirmCancellation(tx: Db, organizationId: string, userId: string, policyId: string) {
    const [updated] = await tx
      .update(policies)
      .set({ lifecycleStatus: "CANCELADA", updatedAt: new Date() })
      .where(and(eq(policies.id, policyId), eq(policies.lifecycleStatus, "CANCELACION_PENDIENTE")))
      .returning();
    if (!updated) throw new PolicyStateError("La póliza no tiene una cancelación pendiente");

    await tx.insert(policyEvents).values({
      organizationId,
      policyId,
      eventType: "CANCELLATION_CONFIRMED",
      fromStatus: "CANCELACION_PENDIENTE",
      toStatus: "CANCELADA",
      userId,
    });

    return updated;
  },

  /**
   * Reparte el total en `count` cuotas iguales, la última absorbe el
   * residuo de redondeo (nunca se pierde ni se inventa un centavo).
   * `BASE_PENDIENTE` trae hasta 12 columnas 1..12 — de ahí el máximo.
   */
  async generateInstallments(
    tx: Db,
    organizationId: string,
    policyId: string,
    params: { count: number; totalCents: number; firstDueDate?: string },
  ) {
    const base = Math.floor(params.totalCents / params.count);
    const remainder = params.totalCents - base * params.count;

    const firstDue = params.firstDueDate ? new Date(params.firstDueDate) : null;

    const rows = Array.from({ length: params.count }, (_, i) => {
      const dueDate = firstDue
        ? new Date(Date.UTC(firstDue.getUTCFullYear(), firstDue.getUTCMonth() + i, firstDue.getUTCDate()))
            .toISOString()
            .slice(0, 10)
        : null;
      return {
        organizationId,
        policyId,
        installmentNumber: i + 1,
        dueDate,
        amountCents: base + (i === params.count - 1 ? remainder : 0),
      };
    });

    return tx.insert(policyInstallments).values(rows).returning();
  },

  async markInstallmentPaid(tx: Db, installmentId: string) {
    const [updated] = await tx
      .update(policyInstallments)
      .set({ isPaid: true, paidAt: new Date() })
      .where(eq(policyInstallments.id, installmentId))
      .returning();
    return updated;
  },

  async listInstallments(tx: Db, policyId: string) {
    return tx
      .select()
      .from(policyInstallments)
      .where(eq(policyInstallments.policyId, policyId))
      .orderBy(policyInstallments.installmentNumber);
  },

  async findById(tx: Db, policyId: string) {
    const [policy] = await tx.select().from(policies).where(eq(policies.id, policyId));
    return policy ?? null;
  },

  /** Detalle completo para /cartera/[policyId] — póliza + cliente + aseguradora + comisión. */
  async getDetail(tx: Db, policyId: string) {
    const [row] = await tx
      .select({
        policy: policies,
        insurerName: insurers.name,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientBusinessName: clients.businessName,
        clientDocumentNumber: clients.documentNumber,
      })
      .from(policies)
      .innerJoin(insurers, eq(insurers.id, policies.insurerId))
      .innerJoin(clients, eq(clients.id, policies.clientId))
      .where(eq(policies.id, policyId));
    if (!row) return null;

    const [commission] = await tx.select().from(commissions).where(eq(commissions.policyId, policyId));
    const installments = await policyService.listInstallments(tx, policyId);

    return { ...row, commission: commission ?? null, installments };
  },

  /** Cartera — lista completa o filtrada por vigencia (pendientes vs. canceladas), con datos para mostrar en tabla. */
  async list(tx: Db, filters?: { lifecycleStatus?: "VIGENTE" | "CANCELACION_PENDIENTE" | "CANCELADA" }) {
    const conditions = filters?.lifecycleStatus
      ? [eq(policies.lifecycleStatus, filters.lifecycleStatus)]
      : [];
    return tx
      .select({
        id: policies.id,
        policyNumber: policies.policyNumber,
        branch: policies.branch,
        issueStatus: policies.issueStatus,
        paymentStatus: policies.paymentStatus,
        lifecycleStatus: policies.lifecycleStatus,
        premiumCents: policies.premiumCents,
        startsAt: policies.startsAt,
        endsAt: policies.endsAt,
        createdAt: policies.createdAt,
        insurerName: insurers.name,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientBusinessName: clients.businessName,
      })
      .from(policies)
      .innerJoin(insurers, eq(insurers.id, policies.insurerId))
      .innerJoin(clients, eq(clients.id, policies.clientId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(policies.createdAt));
  },
};
