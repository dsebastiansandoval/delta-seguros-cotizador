import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { commissions, policies } from "@/db/schema/policies";
import { insurers } from "@/db/schema/catalog";
import { clients } from "@/db/schema/clients";
import { applyPercent } from "@/domains/shared/money";
import { PolicyStateError } from "./policy.service";

/**
 * `% COMISION` es texto/número libre en el Excel, sin tabla por aseguradora
 * (EXCEL-AUDIT.md §2.5) — se fija a mano por póliza acá también, no se
 * inventa una tabla de comisión que el Excel nunca tuvo.
 */
export const commissionService = {
  async setPercent(tx: Db, commissionId: string, percent: number) {
    const [existing] = await tx.select().from(commissions).where(eq(commissions.id, commissionId));
    if (!existing) throw new Error("Comisión no encontrada");

    const amountCents = applyPercent(existing.baseAmountCents, percent);

    // Si la póliza ya se canceló, el descuento se recalcula con el nuevo %.
    let discountAmountCents = existing.discountAmountCents;
    if (existing.discountStatus === "PENDIENTE") {
      const [policy] = await tx.select().from(policies).where(eq(policies.id, existing.policyId));
      if (policy?.cancelledPremiumCents != null) discountAmountCents = applyPercent(policy.cancelledPremiumCents, percent);
    }

    const [updated] = await tx
      .update(commissions)
      .set({ percent: percent.toFixed(2), amountCents, discountAmountCents })
      .where(eq(commissions.id, commissionId))
      .returning();
    return updated;
  },

  async markPaid(tx: Db, commissionId: string) {
    const [updated] = await tx
      .update(commissions)
      .set({ status: "COMISIONADA", paidAt: new Date() })
      .where(eq(commissions.id, commissionId))
      .returning();
    return updated;
  },

  /** La aseguradora ya descontó la comisión de la póliza cancelada (COMISION → DESCONTADA). */
  async markDiscounted(tx: Db, commissionId: string) {
    const [updated] = await tx
      .update(commissions)
      .set({ discountStatus: "DESCONTADA", discountedAt: new Date() })
      .where(and(eq(commissions.id, commissionId), eq(commissions.discountStatus, "PENDIENTE")))
      .returning();
    if (!updated) throw new PolicyStateError("Esta comisión no tiene un descuento pendiente");
    return updated;
  },

  async list(tx: Db, filters?: { agentId?: string }) {
    return tx
      .select({
        id: commissions.id,
        policyId: commissions.policyId,
        policyNumber: policies.policyNumber,
        insurerName: insurers.name,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientBusinessName: clients.businessName,
        baseAmountCents: commissions.baseAmountCents,
        percent: commissions.percent,
        amountCents: commissions.amountCents,
        status: commissions.status,
        paidAt: commissions.paidAt,
        discountStatus: commissions.discountStatus,
        discountAmountCents: commissions.discountAmountCents,
      })
      .from(commissions)
      .innerJoin(policies, eq(policies.id, commissions.policyId))
      .innerJoin(insurers, eq(insurers.id, commissions.insurerId))
      .innerJoin(clients, eq(clients.id, policies.clientId))
      .where(filters?.agentId ? eq(commissions.agentId, filters.agentId) : undefined)
      .orderBy(desc(policies.createdAt));
  },
};
