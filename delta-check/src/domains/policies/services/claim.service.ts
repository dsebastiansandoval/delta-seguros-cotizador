import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { claimEvents, claims, policies } from "@/db/schema/policies";
import { insurers } from "@/db/schema/catalog";
import { clients, vehicles } from "@/db/schema/clients";
import { quoteOptions, quoteRisks } from "@/db/schema/quoting";
import { users } from "@/db/schema/identity";
import { dollarsToCents } from "@/domains/shared/money";
import type { z } from "zod";
import type { reportClaimSchema } from "../schemas/policy.schema";

type ReportClaimInput = z.infer<typeof reportClaimSchema>;
type ClaimStatus = "REPORTADO" | "APROBADO" | "REPARADO" | "ENTREGADO";

// Siniestro reportado directo desde Siniestros (sin policyId): "sus" datos
// de aseguradora/cliente salen de claims.*, no de un join a policies —
// mismo alias en list() y getDetail() para no repetir la unión.
const standaloneInsurer = alias(insurers, "standalone_insurer");

/** REPORTADO → APROBADO → REPARADO → ENTREGADO — ENTREGADO lo sacó el 6-nov de la lista de vigentes. */
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
        vehiclePlate: standalone ? input.vehiclePlate : undefined,
        vehicleBrand: standalone ? input.vehicleBrand : undefined,
        vehicleModel: standalone ? input.vehicleModel : undefined,
        vehicleYear: standalone ? input.vehicleYear : undefined,
        vehicleColor: standalone ? input.vehicleColor : undefined,
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

  /** Etiqueta corta para el asunto del correo de "Agregar y notificar" — N° de siniestro, o si no hay, el cliente. */
  async getLabel(tx: Db, claimId: string): Promise<string | null> {
    const [row] = await tx
      .select({
        claimNumber: claims.claimNumber,
        policyNumber: sql<string | null>`coalesce(${policies.policyNumber}, ${claims.policyNumber})`,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientBusinessName: clients.businessName,
        standaloneClientName: claims.clientName,
      })
      .from(claims)
      .leftJoin(policies, eq(policies.id, claims.policyId))
      .leftJoin(clients, eq(clients.id, policies.clientId))
      .where(eq(claims.id, claimId));
    if (!row) return null;

    const clientName = row.clientBusinessName || `${row.clientFirstName ?? ""} ${row.clientLastName ?? ""}`.trim() || row.standaloneClientName;
    return row.claimNumber || clientName || row.policyNumber || "sin identificar";
  },

  /**
   * Solo los ramos del usuario (users.branches), mismo criterio que Cartera
   * y Back-office. `claims.branch` es siempre propio (nunca viene solo del
   * join a policies), así que un siniestro sin póliza también se filtra bien.
   *
   * Sin `search`: solo vigentes (todo menos ENTREGADO) — lo que importa dar
   * seguimiento día a día. Con `search`: busca en TODOS los estados
   * (incluye entregados) por cliente o número de póliza — el "buscador de
   * cerrados" que pidió David el 6-nov, para encontrar el histórico sin que
   * la lista del día a día se llene de siniestros ya resueltos.
   */
  async list(tx: Db, branches: Array<"AUTOS" | "SALUD">, search?: string) {
    const term = search?.trim();
    const conditions = [inArray(claims.branch, branches)];
    if (!term) {
      conditions.push(ne(claims.status, "ENTREGADO"));
    } else {
      const like = `%${term}%`;
      conditions.push(
        or(
          ilike(sql`coalesce(${policies.policyNumber}, ${claims.policyNumber})`, like),
          ilike(clients.firstName, like),
          ilike(clients.lastName, like),
          ilike(clients.businessName, like),
          ilike(claims.clientName, like),
        )!,
      );
    }

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
      .where(and(...conditions))
      .orderBy(desc(claims.reportedAt));
  },

  /**
   * Detalle de un siniestro + su historial completo de novedades, para la
   * página de detalle. Si hay `policyId`, el vehículo real se alcanza por
   * policy → quote_option → quote_risk → vehicle (nunca se duplica en
   * `claims`); si no hay póliza, viene de los `vehicle*` que se piden a
   * mano al reportar — `vehicle` siempre es la misma forma para la página,
   * sin importar de cuál de las dos fuentes salió.
   */
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
        policyVehiclePlate: vehicles.plate,
        policyVehicleBrand: vehicles.brand,
        policyVehicleModel: vehicles.model,
        policyVehicleYear: vehicles.year,
        policyVehicleColor: vehicles.color,
      })
      .from(claims)
      .leftJoin(policies, eq(policies.id, claims.policyId))
      .leftJoin(insurers, eq(insurers.id, policies.insurerId))
      .leftJoin(standaloneInsurer, eq(standaloneInsurer.id, claims.insurerId))
      .leftJoin(clients, eq(clients.id, policies.clientId))
      .leftJoin(quoteOptions, eq(quoteOptions.id, policies.quoteOptionId))
      .leftJoin(quoteRisks, eq(quoteRisks.id, quoteOptions.quoteRiskId))
      .leftJoin(vehicles, eq(vehicles.id, quoteRisks.vehicleId))
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

    const vehicle = row.claim.policyId
      ? {
          plate: row.policyVehiclePlate,
          brand: row.policyVehicleBrand,
          model: row.policyVehicleModel,
          year: row.policyVehicleYear,
          color: row.policyVehicleColor,
        }
      : {
          plate: row.claim.vehiclePlate,
          brand: row.claim.vehicleBrand,
          model: row.claim.vehicleModel,
          year: row.claim.vehicleYear,
          color: row.claim.vehicleColor,
        };

    return { ...row, vehicle, events };
  },
};
