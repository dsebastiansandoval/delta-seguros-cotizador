import { desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { commissions, policies } from "@/db/schema/policies";
import { insurers } from "@/db/schema/catalog";
import { clients } from "@/db/schema/clients";
import { applyPercent } from "@/domains/shared/money";

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

    const [updated] = await tx
      .update(commissions)
      .set({ percent: percent.toFixed(2), amountCents })
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
      })
      .from(commissions)
      .innerJoin(policies, eq(policies.id, commissions.policyId))
      .innerJoin(insurers, eq(insurers.id, commissions.insurerId))
      .innerJoin(clients, eq(clients.id, policies.clientId))
      .where(filters?.agentId ? eq(commissions.agentId, filters.agentId) : undefined)
      .orderBy(desc(policies.createdAt));
  },
};
