import { and, asc, count, desc, eq, gte, inArray, isNull, lt, lte, ne, or, sum } from "drizzle-orm";
import type { Db } from "@/db";
import { insurers } from "@/db/schema/catalog";
import { clients, vehicles } from "@/db/schema/clients";
import { claims, commissions, policies, policyInstallments } from "@/db/schema/policies";
import { quoteOptions, quoteRisks, quotes } from "@/db/schema/quoting";
import type { ReportMonth } from "@/domains/dashboard/services/agent-report";
import { todayInEcuador } from "@/domains/health/services/health-rate-admin.service";
import {
  addDays,
  BASE_HEADERS,
  type BackOfficeBase,
  csvMoney,
  type CsvValue,
  DUE_SOON_DAYS,
  daysBetween,
  installmentColumns,
  installmentUrgency,
  toCsv,
} from "./back-office";

type Branch = "AUTOS" | "SALUD";

const ISSUE_LABEL = { PENDIENTE: "PENDIENTE", INSPECCION: "INSPECCION", EMITIDA: "EMITIDA", NO_EMITIDA: "NO EMITIDA" };
const LIFECYCLE_LABEL = { VIGENTE: "VIGENTE", CANCELACION_PENDIENTE: "PENDIENTE", CANCELADA: "CANCELADA" };

const clientColumns = {
  clientFirstName: clients.firstName,
  clientLastName: clients.lastName,
  clientBusinessName: clients.businessName,
};

/** Fecha en Ecuador de un timestamp, como la escribía el Excel (FECHA EMISION). */
const ecuadorDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(d);

/** Póliza "viva" para la operación: no anulada por error ni cancelada del todo. */
const operative = (branches: Branch[]) =>
  and(inArray(policies.branch, branches), eq(policies.isVoid, false), ne(policies.lifecycleStatus, "CANCELADA"));

/**
 * Back-office: lo que en el Excel se seguía a mano en las hojas BASE
 * (EMISIONES, PENDIENTE, COMISIONES, CANCELADAS, SINIESTROS), juntado como
 * colas de trabajo de todas las pólizas. Cada acción se sigue haciendo en el
 * detalle de la póliza (/cartera/[id]); acá solo se ve qué falta.
 */
export const backOfficeService = {
  async overview(tx: Db, params: { branches: Branch[]; month: ReportMonth; includeCommissions: boolean }) {
    const { branches } = params;
    const today = todayInEcuador();
    if (branches.length === 0) return null;

    // Tarjetas de la maqueta ("Módulos de gestión interna").
    const byStatus = await tx
      .select({ issueStatus: policies.issueStatus, lifecycleStatus: policies.lifecycleStatus, total: count() })
      .from(policies)
      .where(and(inArray(policies.branch, branches), eq(policies.isVoid, false)))
      .groupBy(policies.issueStatus, policies.lifecycleStatus);
    const issueSummary = { emitidas: 0, enTramite: 0, noEmitidas: 0, canceladas: 0 };
    for (const r of byStatus) {
      if (r.lifecycleStatus !== "VIGENTE") issueSummary.canceladas += r.total;
      else if (r.issueStatus === "EMITIDA") issueSummary.emitidas += r.total;
      else if (r.issueStatus === "NO_EMITIDA") issueSummary.noEmitidas += r.total;
      else issueSummary.enTramite += r.total;
    }

    const claimsByStatus = await tx
      .select({ status: claims.status, total: count() })
      .from(claims)
      .innerJoin(policies, eq(policies.id, claims.policyId))
      .where(inArray(policies.branch, branches))
      .groupBy(claims.status);

    // Colas de trabajo.
    const pendingIssues = (
      await tx
        .select({
          id: policies.id,
          policyNumber: policies.policyNumber,
          issueStatus: policies.issueStatus,
          inspectionRequired: policies.inspectionRequired,
          createdAt: policies.createdAt,
          insurerName: insurers.name,
          ...clientColumns,
        })
        .from(policies)
        .innerJoin(insurers, eq(insurers.id, policies.insurerId))
        .innerJoin(clients, eq(clients.id, policies.clientId))
        .where(and(operative(branches), inArray(policies.issueStatus, ["PENDIENTE", "INSPECCION"])))
        .orderBy(asc(policies.createdAt))
    ).map((p) => ({ ...p, daysWaiting: daysBetween(ecuadorDate(p.createdAt), today) }));

    const dueInstallments = (
      await tx
        .select({
          id: policyInstallments.id,
          policyId: policies.id,
          policyNumber: policies.policyNumber,
          installmentNumber: policyInstallments.installmentNumber,
          dueDate: policyInstallments.dueDate,
          amountCents: policyInstallments.amountCents,
          insurerName: insurers.name,
          ...clientColumns,
        })
        .from(policyInstallments)
        .innerJoin(policies, eq(policies.id, policyInstallments.policyId))
        .innerJoin(insurers, eq(insurers.id, policies.insurerId))
        .innerJoin(clients, eq(clients.id, policies.clientId))
        .where(
          and(
            operative(branches),
            eq(policyInstallments.isPaid, false),
            lte(policyInstallments.dueDate, addDays(today, DUE_SOON_DAYS)),
          ),
        )
        .orderBy(asc(policyInstallments.dueDate), asc(policyInstallments.installmentNumber))
    ).map((i) => ({ ...i, urgency: installmentUrgency(i.dueDate, today)!, days: daysBetween(today, i.dueDate!) }));

    const pendingCancellations = await tx
      .select({
        id: policies.id,
        policyNumber: policies.policyNumber,
        cancelledAt: policies.cancelledAt,
        cancellationReason: policies.cancellationReason,
        insurerName: insurers.name,
        ...clientColumns,
      })
      .from(policies)
      .innerJoin(insurers, eq(insurers.id, policies.insurerId))
      .innerJoin(clients, eq(clients.id, policies.clientId))
      .where(
        and(
          inArray(policies.branch, branches),
          eq(policies.isVoid, false),
          eq(policies.lifecycleStatus, "CANCELACION_PENDIENTE"),
        ),
      )
      .orderBy(asc(policies.cancelledAt));

    const commissionsBlock = params.includeCommissions
      ? await backOfficeService.commissionQueues(tx, branches, params.month)
      : null;

    return {
      today,
      issueSummary,
      claimsByStatus,
      pendingIssues,
      dueInstallments,
      pendingCancellations,
      commissions: commissionsBlock,
    };
  },

  /** Comisiones por aseguradora del mes (pólizas emitidas en el mes) y lo que falta resolver. */
  async commissionQueues(tx: Db, branches: Branch[], month: ReportMonth) {
    const byInsurer = await tx
      .select({ insurerName: insurers.name, policies: count(), amountCents: sum(commissions.amountCents) })
      .from(commissions)
      .innerJoin(policies, eq(policies.id, commissions.policyId))
      .innerJoin(insurers, eq(insurers.id, commissions.insurerId))
      .where(
        and(
          inArray(policies.branch, branches),
          eq(policies.isVoid, false),
          gte(policies.createdAt, month.start),
          lt(policies.createdAt, month.end),
        ),
      )
      .groupBy(insurers.name)
      .orderBy(desc(sum(commissions.amountCents)));

    // Sin % (no se puede calcular) o con descuento por cancelación sin aplicar.
    const toResolve = await tx
      .select({
        id: commissions.id,
        policyId: policies.id,
        policyNumber: policies.policyNumber,
        percent: commissions.percent,
        discountStatus: commissions.discountStatus,
        discountAmountCents: commissions.discountAmountCents,
        baseAmountCents: commissions.baseAmountCents,
        insurerName: insurers.name,
        ...clientColumns,
      })
      .from(commissions)
      .innerJoin(policies, eq(policies.id, commissions.policyId))
      .innerJoin(insurers, eq(insurers.id, commissions.insurerId))
      .innerJoin(clients, eq(clients.id, policies.clientId))
      .where(
        and(
          inArray(policies.branch, branches),
          eq(policies.isVoid, false),
          or(
            and(isNull(commissions.percent), eq(policies.lifecycleStatus, "VIGENTE")),
            eq(commissions.discountStatus, "PENDIENTE"),
          ),
        ),
      )
      .orderBy(asc(policies.createdAt));

    return {
      byInsurer: byInsurer.map((r) => ({ ...r, amountCents: Number(r.amountCents ?? 0) })),
      toResolve,
    };
  },

  /** Una hoja BASE completa como CSV, con las columnas del Excel. */
  async exportBase(tx: Db, base: BackOfficeBase, branches: Branch[]): Promise<string> {
    const rows = branches.length ? await backOfficeService.baseRows(tx, base, branches) : [];
    return toCsv(BASE_HEADERS[base], rows);
  },

  async baseRows(tx: Db, base: BackOfficeBase, branches: Branch[]): Promise<CsvValue[][]> {
    if (base === "siniestros") {
      const rows = await tx
        .select({
          claim: claims,
          branch: policies.branch,
          policyNumber: policies.policyNumber,
          insurerName: insurers.name,
          documentNumber: clients.documentNumber,
          plate: vehicles.plate,
          brand: vehicles.brand,
          model: vehicles.model,
          ...clientColumns,
        })
        .from(claims)
        .innerJoin(policies, eq(policies.id, claims.policyId))
        .innerJoin(insurers, eq(insurers.id, policies.insurerId))
        .innerJoin(clients, eq(clients.id, policies.clientId))
        .innerJoin(quoteOptions, eq(quoteOptions.id, policies.quoteOptionId))
        .innerJoin(quoteRisks, eq(quoteRisks.id, quoteOptions.quoteRiskId))
        .leftJoin(vehicles, eq(vehicles.id, quoteRisks.vehicleId))
        .where(inArray(policies.branch, branches))
        .orderBy(asc(claims.reportedAt));
      return rows.map((r) => [
        r.claim.occurredAt,
        r.claim.reportedAt,
        r.documentNumber,
        r.clientBusinessName ?? r.clientFirstName,
        r.clientBusinessName ? "" : r.clientLastName,
        r.branch,
        r.insurerName,
        r.policyNumber,
        r.claim.workshop,
        r.claim.advisorName,
        r.claim.contactPhone,
        r.plate,
        r.brand,
        r.model,
        r.claim.hasThirdPartyLiability ? "SI" : "NO",
        r.claim.thirdPartyPlate,
        r.claim.status,
        csvMoney(r.claim.claimValueCents),
        csvMoney(r.claim.thirdPartyValueCents),
        r.claim.notes,
      ]);
    }

    const rows = await tx
      .select({
        policy: policies,
        quoteCode: quotes.code,
        insurerCode: insurers.code,
        insurerName: insurers.name,
        documentType: clients.documentType,
        documentNumber: clients.documentNumber,
        source: clients.source,
        superBancosCents: quoteOptions.superBancosCents,
        campesinoCents: quoteOptions.campesinoCents,
        emissionFeeCents: quoteOptions.emissionFeeCents,
        ivaCents: quoteOptions.ivaCents,
        totalPremiumCents: quoteOptions.totalPremiumCents,
        commission: commissions,
        ...clientColumns,
      })
      .from(policies)
      .innerJoin(insurers, eq(insurers.id, policies.insurerId))
      .innerJoin(clients, eq(clients.id, policies.clientId))
      .innerJoin(quoteOptions, eq(quoteOptions.id, policies.quoteOptionId))
      .innerJoin(quoteRisks, eq(quoteRisks.id, quoteOptions.quoteRiskId))
      .innerJoin(quotes, eq(quotes.id, quoteRisks.quoteId))
      .leftJoin(commissions, eq(commissions.policyId, policies.id))
      .where(
        and(
          inArray(policies.branch, branches),
          eq(policies.isVoid, false),
          base === "canceladas" ? ne(policies.lifecycleStatus, "VIGENTE") : undefined,
        ),
      )
      .orderBy(asc(policies.createdAt));

    const person = (r: (typeof rows)[number]) => [
      r.documentNumber,
      r.clientBusinessName ?? r.clientFirstName,
      r.clientBusinessName ? "" : r.clientLastName,
    ];
    const head = (r: (typeof rows)[number]) => [r.quoteCode, ecuadorDate(r.policy.createdAt), r.documentType, r.source, ...person(r)];
    const p = (r: (typeof rows)[number]) => r.policy;

    if (base === "emisiones") {
      return rows.map((r) => [
        ...head(r),
        p(r).branch,
        r.insurerName,
        p(r).policyNumber,
        p(r).annexNumber,
        ISSUE_LABEL[p(r).issueStatus],
        csvMoney(p(r).premiumCents),
        "",
        p(r).notes,
      ]);
    }

    if (base === "comisiones") {
      return rows.map((r) => [
        ...head(r),
        p(r).policyNumber,
        p(r).branch,
        r.insurerCode,
        r.insurerName,
        p(r).paymentStatus,
        csvMoney(r.commission?.baseAmountCents ?? p(r).premiumCents),
        r.commission?.percent?.replace(".", ","),
        csvMoney(r.commission?.amountCents),
        r.commission?.status,
        r.commission?.notes,
      ]);
    }

    if (base === "canceladas") {
      return rows.map((r) => {
        const [ci, names, lastNames] = person(r);
        return [
          p(r).cancelledAt,
          ci,
          names,
          lastNames,
          r.source,
          r.insurerName,
          p(r).branch,
          p(r).policyNumber,
          csvMoney(p(r).cancelledPremiumCents),
          LIFECYCLE_LABEL[p(r).lifecycleStatus],
          r.commission?.discountStatus,
          p(r).cancellationReason ?? p(r).notes,
        ];
      });
    }

    // pendiente: una fila por póliza, cuotas 1..12 en columnas como el Excel.
    const policyIds = rows.map((r) => r.policy.id);
    const installments = policyIds.length
      ? await tx
          .select()
          .from(policyInstallments)
          .where(inArray(policyInstallments.policyId, policyIds))
          .orderBy(asc(policyInstallments.installmentNumber))
      : [];
    const byPolicy = new Map<string, typeof installments>();
    for (const i of installments) byPolicy.set(i.policyId, [...(byPolicy.get(i.policyId) ?? []), i]);

    return rows.map((r) => {
      const own = byPolicy.get(r.policy.id) ?? [];
      const pending = own.filter((i) => !i.isPaid).reduce((s, i) => s + i.amountCents, 0);
      return [
        ...head(r),
        p(r).branch,
        r.insurerCode,
        r.insurerName,
        p(r).paymentStatus,
        own.length === 0 ? "" : own.length === 1 ? "CONTADO" : "CUOTAS",
        own.length || "",
        p(r).policyNumber,
        p(r).annexNumber,
        p(r).invoiceNumber,
        csvMoney(p(r).premiumCents),
        csvMoney(r.superBancosCents),
        csvMoney(r.campesinoCents),
        csvMoney(r.emissionFeeCents),
        csvMoney(r.ivaCents),
        csvMoney(r.totalPremiumCents),
        own.length ? csvMoney(own[0].amountCents) : "",
        own.length ? csvMoney(pending) : "",
        ...installmentColumns(own.map((i) => ({ number: i.installmentNumber, amountCents: i.amountCents, isPaid: i.isPaid }))),
        p(r).notes,
      ];
    });
  },
};
