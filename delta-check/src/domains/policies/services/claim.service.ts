import { alias } from "drizzle-orm/pg-core";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { claimEvents, claims, policies } from "@/db/schema/policies";
import { insurers } from "@/db/schema/catalog";
import { clients } from "@/db/schema/clients";
import { users } from "@/db/schema/identity";
import { dollarsToCents } from "@/domains/shared/money";
import type { z } from "zod";
import type { reportClaimSchema } from "../schemas/policy.schema";

type ReportClaimInput = z.infer<typeof reportClaimSchema>;
type ClaimStatus = "REPORTADO" | "APROBADO" | "REPARADO";

// Siniestro reportado directo desde Siniestros (sin policyId): "sus" datos
// de aseguradora/cliente salen de claims.*, no de un join a policies —
// mismo alias en list() y getDetail() para no repetir la unión.
const standaloneInsurer = alias(insurers, "standalone_insurer");

/** REPORTADO → APROBADO → REPARADO — mismos 3 estados que la macro SINIESTROS prepara en el Excel. */
export const claimService = {
  async report(tx: Db, organizationId: string, input: ReportClaimInput) {
    const standalone = !input.policyId;
    const [claim] = await tx
      .insert(claims)
      .values({
        organizationId,
        policyId: input.policyId,
        branch: input.branch,
        insurerId: standalone ? input.insurerId : undefined,
        clientName: standalone ? input.clientName : undefined,
        clientDocumentNumber: standalone ? input.clientDocumentNumber : undefined,
        policyNumber: standalone ? input.policyNumber : undefined,
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

  /** Cambia el estado y deja constancia en el historial — de dónde a dónde y quién. */
  async updateStatus(tx: Db, organizationId: string, claimId: string, status: ClaimStatus, userId: string) {
    const [current] = await tx.select({ status: claims.status }).from(claims).where(eq(claims.id, claimId));
    if (!current) return null;

    const [updated] = await tx.update(claims).set({ status }).where(eq(claims.id, claimId)).returning();
    if (current.status !== status) {
      await tx.insert(claimEvents).values({
        organizationId,
        claimId,
        eventType: "STATUS_CHANGE",
        fromStatus: current.status,
        toStatus: status,
        userId,
      });
    }
    return updated;
  },

  /** Agrega una novedad al historial — el "chat" que reemplaza la celda de observaciones del Excel compartido. */
  async addNote(tx: Db, organizationId: string, claimId: string, userId: string, note: string) {
    const [event] = await tx
      .insert(claimEvents)
      .values({ organizationId, claimId, eventType: "NOTA", note, userId })
      .returning();
    return event;
  },

  /**
   * Solo los ramos del usuario (users.branches), mismo criterio que Cartera
   * y Back-office. `claims.branch` es siempre propio (nunca viene solo del
   * join a policies), así que un siniestro sin póliza también se filtra bien.
   */
  async list(tx: Db, branches: Array<"AUTOS" | "SALUD">) {
    return tx
      .select({
        id: claims.id,
        policyId: claims.policyId,
        branch: claims.branch,
        claimNumber: claims.claimNumber,
        status: claims.status,
        occurredAt: claims.occurredAt,
        reportedAt: claims.reportedAt,
        policyNumber: sql<string | null>`coalesce(${policies.policyNumber}, ${claims.policyNumber})`,
        insurerName: insurers.name,
        standaloneInsurerName: standaloneInsurer.name,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientBusinessName: clients.businessName,
        standaloneClientName: claims.clientName,
        claimValueCents: claims.claimValueCents,
      })
      .from(claims)
      .leftJoin(policies, eq(policies.id, claims.policyId))
      .leftJoin(insurers, eq(insurers.id, policies.insurerId))
      .leftJoin(standaloneInsurer, eq(standaloneInsurer.id, claims.insurerId))
      .leftJoin(clients, eq(clients.id, policies.clientId))
      .where(inArray(claims.branch, branches))
      .orderBy(desc(claims.reportedAt));
  },

  /** Detalle de un siniestro + su historial completo de novedades, para la página de detalle. */
  async getDetail(tx: Db, claimId: string) {
    const [row] = await tx
      .select({
        claim: claims,
        policyNumber: sql<string | null>`coalesce(${policies.policyNumber}, ${claims.policyNumber})`,
        insurerName: insurers.name,
        standaloneInsurerName: standaloneInsurer.name,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientBusinessName: clients.businessName,
      })
      .from(claims)
      .leftJoin(policies, eq(policies.id, claims.policyId))
      .leftJoin(insurers, eq(insurers.id, policies.insurerId))
      .leftJoin(standaloneInsurer, eq(standaloneInsurer.id, claims.insurerId))
      .leftJoin(clients, eq(clients.id, policies.clientId))
      .where(eq(claims.id, claimId));
    if (!row) return null;

    const events = await tx
      .select({
        id: claimEvents.id,
        eventType: claimEvents.eventType,
        note: claimEvents.note,
        fromStatus: claimEvents.fromStatus,
        toStatus: claimEvents.toStatus,
        createdAt: claimEvents.createdAt,
        userFullName: users.fullName,
      })
      .from(claimEvents)
      .leftJoin(users, eq(users.id, claimEvents.userId))
      .where(eq(claimEvents.claimId, claimId))
      .orderBy(asc(claimEvents.createdAt));

    return { ...row, events };
  },
};
