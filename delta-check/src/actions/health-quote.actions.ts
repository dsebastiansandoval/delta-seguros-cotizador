"use server";

import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withOrganization } from "@/db";
import { quoteRisks, quotes } from "@/db/schema/quoting";
import { clients } from "@/db/schema/clients";
import { users } from "@/db/schema/identity";
import {
  ensureVendorExists,
  listActiveUsersByBranch,
  requireBranch,
  requirePermission,
  resolveExecutive,
  resolveVendor,
  vendorMode,
} from "@/domains/identity/services/rbac.service";
import { clientService } from "@/domains/clients/services/client.service";
import { clientRepository } from "@/domains/clients/repositories/client.repository";
import { newHealthQuoteSchema, MAX_DEPENDENTS } from "@/domains/health/schemas/health-quote.schema";
import { healthQuoteService, type NewMemberInput } from "@/domains/health/services/health-quote.service";
import { healthComparisonService, HealthComparisonError } from "@/domains/health/services/health-comparison.service";
import { insuredGroupRepository } from "@/domains/health/repositories/insured-group.repository";
import { getCaratulaAMData } from "@/domains/health/services/caratula-am.service";
import { audit } from "@/domains/shared/audit";
import { dollarsToCents } from "@/domains/shared/money";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "./quote.actions";
import type { Db } from "@/db";

/**
 * Cliente de Salud por cédula, o por nombre+fecha de nacimiento cuando no
 * hay cédula (pedido de Delta, 17-nov — ver newHealthQuoteSchema). El
 * refine del schema ya exige `titularBirthDate` cuando no hay documento,
 * pero zod no lo refleja en el tipo — de ahí el chequeo explícito acá.
 */
async function upsertHealthClient(
  tx: Db,
  params: {
    organizationId: string;
    documentType: "CEDULA" | "RUC" | "PASAPORTE" | undefined;
    documentNumber: string | undefined;
    firstName: string | undefined;
    lastName: string | undefined;
    titularBirthDate: string | undefined;
    executive: string | undefined;
    vendor: string | undefined;
    assignedAgentId: string;
  },
) {
  if (params.documentNumber) {
    return {
      ok: true as const,
      client: await clientService.upsertByDocument(tx, {
        organizationId: params.organizationId,
        personType: "NATURAL",
        documentType: params.documentType ?? "CEDULA",
        documentNumber: params.documentNumber,
        firstName: params.firstName,
        lastName: params.lastName,
        executive: params.executive,
        vendor: params.vendor,
        assignedAgentId: params.assignedAgentId,
      }),
    };
  }

  if (!params.firstName || !params.lastName || !params.titularBirthDate) {
    return { ok: false as const, message: "Sin cédula, nombre, apellido y fecha de nacimiento son obligatorios" };
  }

  return {
    ok: true as const,
    client: await clientService.upsertByNameAndBirthDate(tx, {
      organizationId: params.organizationId,
      personType: "NATURAL",
      documentType: null,
      documentNumber: null,
      firstName: params.firstName,
      lastName: params.lastName,
      birthDate: params.titularBirthDate,
      executive: params.executive,
      vendor: params.vendor,
      assignedAgentId: params.assignedAgentId,
    }),
  };
}

export async function createHealthQuote(
  _prevState: ActionResult<{ quoteId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ quoteId: string }>> {
  const session = await requirePermission("quote:create");
  requireBranch(session, "SALUD");
  await rateLimit(`quote:${session.userId}`, { limit: 30, window: "1 m" });

  const parsed = newHealthQuoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const input = parsed.data;
  input.executive = resolveExecutive(session);

  const members: NewMemberInput[] = [{ relation: "TITULAR", age: input.titularAge, gender: input.titularGender }];
  for (let i = 1; i <= MAX_DEPENDENTS; i++) {
    const age = input[`dep${i}Age` as keyof typeof input] as number | undefined;
    const gender = input[`dep${i}Gender` as keyof typeof input] as "MASCULINO" | "FEMENINO" | undefined;
    if (age != null && gender) members.push({ relation: "DEPENDIENTE", age, gender });
  }

  const result = await withOrganization(session.organizationId, async (tx) => {
    input.vendor = resolveVendor(session, input.vendor, await listActiveUsersByBranch(tx, "SALUD"));
    if (vendorMode(session) === "free" && input.vendor) {
      await ensureVendorExists(tx, session.organizationId, input.vendor);
    }

    const clientResult = await upsertHealthClient(tx, {
      organizationId: session.organizationId,
      documentType: input.documentType,
      documentNumber: input.documentNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      titularBirthDate: input.titularBirthDate,
      executive: input.executive,
      vendor: input.vendor,
      assignedAgentId: session.userId,
    });
    if (!clientResult.ok) return clientResult;
    const client = clientResult.client;

    const { quote, risk } = await healthQuoteService.createHealthQuote(tx, {
      organizationId: session.organizationId,
      agentId: session.userId,
      clientId: client.id,
      region: input.region,
      members,
      operationType: "NUEVA",
    });

    await healthComparisonService.runComparisonForRisk(tx, session.organizationId, risk.id);

    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "health_quote.created",
      entityType: "quotes",
      entityId: quote.id,
      metadata: { members: members.length },
    });

    return { ok: true as const, quoteId: quote.id };
  });

  if (!result.ok) return { ok: false, errors: { form: [result.message] } };

  revalidatePath("/cotizar/salud");
  redirect(`/cotizar/salud/${result.quoteId}/configurar`);
}

/**
 * Edición completa de una cotización de Salud, sin importar el estado
 * (pedido explícito de Delta, 17-nov) — deja agregar/quitar
 * dependientes, cambiar región, y corregir cliente/titular, todo lo que
 * createHealthQuote permite al crear. Si algo de eso cambia, se
 * recalcula la comparativa entera (healthComparisonService.resetForRisk
 * + runComparisonForRisk) — resetForRisk ya bloquea si la cotización
 * tiene una póliza emitida.
 */
export async function updateHealthQuote(
  _prevState: ActionResult<{ quoteId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ quoteId: string }>> {
  const session = await requirePermission("quote:create");
  requireBranch(session, "SALUD");
  await rateLimit(`quote:${session.userId}`, { limit: 30, window: "1 m" });

  const quoteId = formData.get("quoteId");
  if (typeof quoteId !== "string" || !quoteId) {
    return { ok: false, errors: { form: ["Cotización inválida"] } };
  }

  const parsed = newHealthQuoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const input = parsed.data;
  input.executive = resolveExecutive(session);

  const desiredDependents: Array<{ age: number; gender: "MASCULINO" | "FEMENINO"; birthDate?: string }> = [];
  for (let i = 1; i <= MAX_DEPENDENTS; i++) {
    const age = input[`dep${i}Age` as keyof typeof input] as number | undefined;
    const gender = input[`dep${i}Gender` as keyof typeof input] as "MASCULINO" | "FEMENINO" | undefined;
    const birthDate = input[`dep${i}BirthDate` as keyof typeof input] as string | undefined;
    if (age != null && gender) desiredDependents.push({ age, gender, birthDate });
  }

  let result: { ok: true; quoteId: string } | { ok: false; message: string };
  try {
    result = await withOrganization(session.organizationId, async (tx) => {
      input.vendor = resolveVendor(session, input.vendor, await listActiveUsersByBranch(tx, "SALUD"));
      if (vendorMode(session) === "free" && input.vendor) {
        await ensureVendorExists(tx, session.organizationId, input.vendor);
      }

      const quote = await healthQuoteService.findById(tx, quoteId);
      if (!quote || quote.branch !== "SALUD") return { ok: false as const, message: "Cotización no encontrada" };

      const [risk] = await tx.select().from(quoteRisks).where(eq(quoteRisks.quoteId, quoteId)).limit(1);
      if (!risk?.insuredGroupId) return { ok: false as const, message: "Cotización sin grupo asegurado" };

      const group = await insuredGroupRepository.findById(tx, risk.insuredGroupId);
      if (!group) return { ok: false as const, message: "Grupo asegurado no encontrado" };

      const clientResult = await upsertHealthClient(tx, {
        organizationId: session.organizationId,
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        titularBirthDate: input.titularBirthDate,
        executive: input.executive,
        vendor: input.vendor,
        assignedAgentId: quote.agentId,
      });
      if (!clientResult.ok) return clientResult;
      const client = clientResult.client;
      if (client.id !== quote.clientId) {
        await tx.update(quotes).set({ clientId: client.id, updatedAt: new Date() }).where(eq(quotes.id, quoteId));
      }

      const existingMembers = await insuredGroupRepository.findMembers(tx, group.id);
      const titular = existingMembers.find((m) => m.relation === "TITULAR");
      const existingDependents = existingMembers.filter((m) => m.relation === "DEPENDIENTE");
      if (!titular) return { ok: false as const, message: "Titular no encontrado" };

      const titularChanged =
        titular.age !== input.titularAge ||
        titular.gender !== input.titularGender ||
        (titular.birthDate ?? null) !== (input.titularBirthDate ?? null);
      const regionChanged = group.region !== input.region;
      const dependentCountChanged = existingDependents.length !== desiredDependents.length;
      const dependentsChanged =
        dependentCountChanged ||
        existingDependents.some(
          (m, i) =>
            m.age !== desiredDependents[i]?.age ||
            m.gender !== desiredDependents[i]?.gender ||
            (m.birthDate ?? null) !== (desiredDependents[i]?.birthDate ?? null),
        );

      const needsRecompute = titularChanged || regionChanged || dependentsChanged;

      if (needsRecompute) {
        // Borra la comparativa vieja ANTES de tocar los miembros — también
        // es el guard de "ya tiene póliza emitida" (HealthComparisonError).
        await healthComparisonService.resetForRisk(tx, risk.id);

        await insuredGroupRepository.updateMember(tx, titular.id, {
          age: input.titularAge,
          gender: input.titularGender,
          birthDate: input.titularBirthDate ?? null,
        });
        if (regionChanged) await insuredGroupRepository.updateRegion(tx, group.id, input.region);

        const keepCount = Math.min(existingDependents.length, desiredDependents.length);
        for (let i = 0; i < keepCount; i++) {
          await insuredGroupRepository.updateMember(tx, existingDependents[i].id, {
            age: desiredDependents[i].age,
            gender: desiredDependents[i].gender,
            birthDate: desiredDependents[i].birthDate ?? null,
          });
        }
        for (let i = keepCount; i < existingDependents.length; i++) {
          await insuredGroupRepository.deleteMember(tx, existingDependents[i].id);
        }
        for (let i = keepCount; i < desiredDependents.length; i++) {
          await insuredGroupRepository.addMember(tx, {
            organizationId: session.organizationId,
            groupId: group.id,
            relation: "DEPENDIENTE",
            age: desiredDependents[i].age,
            gender: desiredDependents[i].gender,
            birthDate: desiredDependents[i].birthDate ?? null,
          });
        }

        await healthComparisonService.runComparisonForRisk(tx, session.organizationId, risk.id);
      }

      await audit(tx, {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "health_quote.edited",
        entityType: "quotes",
        entityId: quoteId,
        metadata: { recomputed: needsRecompute },
      });

      return { ok: true as const, quoteId };
    });
  } catch (error) {
    if (error instanceof HealthComparisonError) return { ok: false, errors: { form: [error.message] } };
    throw error;
  }

  if (!result.ok) return { ok: false, errors: { form: [result.message] } };

  revalidatePath(`/cotizar/salud/${quoteId}/editar`);
  revalidatePath("/cotizar/salud");
  redirect(`/cotizar/salud/${quoteId}/comparar`);
}

/**
 * Precarga para "Editar" de una cotización de Salud — región y
 * dependientes incluidos, para la edición completa (ver
 * updateHealthQuote), sin importar el estado (pedido explícito de
 * Delta, 17-nov: igual que Autos).
 */
export async function getHealthQuoteForEdit(quoteId: string) {
  const session = await requirePermission("quote:create");
  requireBranch(session, "SALUD");

  return withOrganization(session.organizationId, async (tx) => {
    const quote = await healthQuoteService.findById(tx, quoteId);
    if (!quote || quote.branch !== "SALUD") return null;
    const client = await clientRepository.findById(tx, quote.clientId);
    if (!client) return null;

    const [risk] = await tx.select().from(quoteRisks).where(eq(quoteRisks.quoteId, quoteId)).limit(1);
    if (!risk?.insuredGroupId) return null;

    const group = await insuredGroupRepository.findById(tx, risk.insuredGroupId);
    const titular = await insuredGroupRepository.findTitular(tx, risk.insuredGroupId);
    if (!group || !titular) return null;
    const members = await insuredGroupRepository.findMembers(tx, risk.insuredGroupId);
    const dependents = members
      .filter((m) => m.relation === "DEPENDIENTE")
      .map((m) => ({ age: m.age, gender: m.gender, birthDate: m.birthDate }));

    return {
      quoteId: quote.id,
      quoteCode: quote.code,
      client: {
        documentType: client.documentType,
        documentNumber: client.documentNumber,
        firstName: client.firstName,
        lastName: client.lastName,
        vendor: client.vendor,
      },
      titular: { age: titular.age, gender: titular.gender, birthDate: titular.birthDate },
      region: group.region,
      dependents,
    };
  });
}

const money = z.union([z.literal(""), z.coerce.number().positive("La prima debe ser mayor a 0")]);

/**
 * Configuración de OFERTA AM: qué planes se muestran (`included`) y las
 * primas netas digitadas a mano (`premium:<quoteOptionId>`). Lleva a la comparativa.
 */
export async function saveHealthOfferConfiguration(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("quote:create");
  requireBranch(session, "SALUD");
  await rateLimit(`quote:${session.userId}`, { limit: 30, window: "1 m" });

  const quoteId = z.uuid().safeParse(formData.get("quoteId"));
  if (!quoteId.success) return { ok: false, errors: { form: ["Cotización inválida"] } };

  const includedIds = z.array(z.uuid()).safeParse(formData.getAll("included"));
  const premiumIds = z.array(z.uuid()).safeParse(formData.getAll("premiumOptionId"));
  if (!includedIds.success || !premiumIds.success) return { ok: false, errors: { form: ["Datos inválidos"] } };

  const premiums: Array<{ quoteOptionId: string; netPremiumCents: number | null }> = [];
  for (const quoteOptionId of premiumIds.data) {
    const parsed = money.safeParse(formData.get(`premium:${quoteOptionId}`) ?? "");
    if (!parsed.success) return { ok: false, errors: { form: [parsed.error.issues[0].message] } };
    premiums.push({ quoteOptionId, netPremiumCents: parsed.data === "" ? null : dollarsToCents(parsed.data) });
  }

  const saved = await withOrganization(session.organizationId, async (tx) => {
    const [risk] = await tx.select().from(quoteRisks).where(eq(quoteRisks.quoteId, quoteId.data)).limit(1);
    if (!risk) return false;
    await healthComparisonService.saveConfiguration(tx, risk.id, { includedIds: includedIds.data, premiums });
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "quote.offer_configured",
      entityType: "quotes",
      entityId: quoteId.data,
      metadata: { plans: includedIds.data.length },
    });
    return true;
  });
  if (!saved) return { ok: false, errors: { form: ["Cotización no encontrada"] } };

  revalidatePath(`/cotizar/salud/${quoteId.data}/comparar`);
  if (formData.get("intent") === "save") {
    revalidatePath(`/cotizar/salud/${quoteId.data}/configurar`);
    return { ok: true, value: undefined };
  }
  redirect(`/cotizar/salud/${quoteId.data}/comparar`);
}

export async function getHealthOfferSheet(quoteId: string) {
  const session = await requirePermission("quote:read");
  requireBranch(session, "SALUD");
  return withOrganization(session.organizationId, (tx) => getCaratulaAMData(tx, quoteId));
}

/**
 * "Mis cotizaciones" de Salud — mismo patrón exacto que
 * `listMyAutoQuotes()` (quote.actions.ts): lista de trabajo personal del
 * agente (filtra por `agentId`, no toda la organización), no un reporte
 * gerencial.
 */
/** "Mis cotizaciones — Salud" — mismo criterio que listMyAutoQuotes (quote:read_all ve todo el ramo, con quién la cargó). */
export async function listMyHealthQuotes() {
  const session = await requirePermission("quote:read");
  requireBranch(session, "SALUD");
  const seeAll = session.permissions.has("quote:read_all");

  return withOrganization(session.organizationId, (tx) =>
    tx
      .select({
        id: quotes.id,
        code: quotes.code,
        status: quotes.status,
        operationType: quotes.operationType,
        createdAt: quotes.createdAt,
        documentNumber: clients.documentNumber,
        agentName: users.fullName,
      })
      .from(quotes)
      .innerJoin(clients, eq(clients.id, quotes.clientId))
      .innerJoin(users, eq(users.id, quotes.agentId))
      .where(seeAll ? eq(quotes.branch, "SALUD") : and(eq(quotes.agentId, session.userId), eq(quotes.branch, "SALUD")))
      .orderBy(desc(quotes.createdAt))
      .limit(seeAll ? 200 : 50),
  );
}

export async function getHealthQuoteComparison(quoteId: string) {
  const session = await requirePermission("quote:read");
  requireBranch(session, "SALUD");

  return withOrganization(session.organizationId, async (tx) => {
    const quote = await healthQuoteService.findById(tx, quoteId);
    if (!quote) return null;

    const [risk] = await tx.select().from(quoteRisks).where(eq(quoteRisks.quoteId, quoteId));
    if (!risk) return null;

    const rows = await healthComparisonService.getComparisonForRisk(tx, risk.id);
    return { quote, rows };
  });
}
