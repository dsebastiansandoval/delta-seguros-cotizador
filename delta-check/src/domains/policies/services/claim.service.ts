import { desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { claims, policies } from "@/db/schema/policies";
import { insurers } from "@/db/schema/catalog";
import { clients } from "@/db/schema/clients";
import { dollarsToCents } from "@/domains/shared/money";
import type { z } from "zod";
import type { reportClaimSchema } from "../schemas/policy.schema";

type ReportClaimInput = z.infer<typeof reportClaimSchema>;

/** REPORTADO → APROBADO → REPARADO — mismos 3 estados que la macro SINIESTROS prepara en el Excel. */
export const claimService = {
  async report(tx: Db, organizationId: string, input: ReportClaimInput) {
    const [claim] = await tx
      .insert(claims)
      .values({
        organizationId,
        policyId: input.policyId,
        claimNumber: input.claimNumber,
        occurredAt: input.occurredAt,
        reportedAt: input.reportedAt,
        description: input.description,
        workshop: input.workshop,
        advisorName: input.advisorName,
        contactPhone: input.contactPhone,
        hasThirdPartyLiability: input.hasThirdPartyLiability,
        thirdPartyPlate: input.thirdPartyPlate,
        claimValueCents:
          input.claimValueDollars != null ? dollarsToCents(input.claimValueDollars) : undefined,
        thirdPartyValueCents:
          input.thirdPartyValueDollars != null
            ? dollarsToCents(input.thirdPartyValueDollars)
            : undefined,
        deductibleAppliedCents:
          input.deductibleAppliedDollars != null
            ? dollarsToCents(input.deductibleAppliedDollars)
            : undefined,
      })
      .returning();
    return claim;
  },

  async updateStatus(tx: Db, claimId: string, status: "REPORTADO" | "APROBADO" | "REPARADO") {
    const [updated] = await tx
      .update(claims)
      .set({ status })
      .where(eq(claims.id, claimId))
      .returning();
    return updated;
  },

  async list(tx: Db) {
    return tx
      .select({
        id: claims.id,
        policyId: claims.policyId,
        claimNumber: claims.claimNumber,
        status: claims.status,
        occurredAt: claims.occurredAt,
        reportedAt: claims.reportedAt,
        policyNumber: policies.policyNumber,
        insurerName: insurers.name,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientBusinessName: clients.businessName,
        claimValueCents: claims.claimValueCents,
      })
      .from(claims)
      .innerJoin(policies, eq(policies.id, claims.policyId))
      .innerJoin(insurers, eq(insurers.id, policies.insurerId))
      .innerJoin(clients, eq(clients.id, policies.clientId))
      .orderBy(desc(claims.reportedAt));
  },
};
