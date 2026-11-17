"use server";

import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withOrganization } from "@/db";
import { quoteRisks, quotes } from "@/db/schema/quoting";
import { clients } from "@/db/schema/clients";
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
import { editHealthClientSchema } from "@/domains/clients/schemas/client.schema";
import { newHealthQuoteSchema, MAX_DEPENDENTS } from "@/domains/health/schemas/health-quote.schema";
import { healthQuoteService, type NewMemberInput } from "@/domains/health/services/health-quote.service";
import { healthComparisonService, HealthComparisonError } from "@/domains/health/services/health-comparison.service";
import { insuredGroupRepository } from "@/domains/health/repositories/insured-group.repository";
import { getCaratulaAMData } from "@/domains/health/services/caratula-am.service";
import { audit } from "@/domains/shared/audit";
import { dollarsToCents } from "@/domains/shared/money";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "./quote.actions";

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

  const quoteId = await withOrganization(session.organizationId, async (tx) => {
    input.vendor = resolveVendor(session, input.vendor, await listActiveUsersByBranch(tx, "SALUD"));
    if (vendorMode(session) === "free" && input.vendor) {
      await ensureVendorExists(tx, session.organizationId, input.vendor);
    }

    const client = await clientService.upsertByDocument(tx, {
      organizationId: session.organizationId,
      personType: "NATURAL",
      documentType: input.documentType,
      documentNumber: input.documentNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      executive: input.executive,
      vendor: input.vendor,
      assignedAgentId: session.userId,
    });

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

    return quote.id;
  });

  revalidatePath("/cotizar/salud");
  redirect(`/cotizar/salud/${quoteId}/configurar`);
}

/**
 * Edición completa de una cotización de Salud BORRADOR — a diferencia de
 * updateHealthQuoteClientInfo (nombre + titular nada más, funciona aunque
 * ya se envió), esto deja agregar/quitar dependientes, cambiar región, y
 * corregir edad/género de cualquiera — todo lo que createHealthQuote
 * permite al crear. Si algo de eso cambia, se recalcula la comparativa
 * entera (healthComparisonService.resetForRisk + runComparisonForRisk) —
 * resetForRisk ya bloquea si la cotización tiene una póliza emitida.
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
      if (quote.status !== "BORRADOR") return { ok: false as const, message: "Esta cotización ya no se puede editar" };

      const [risk] = await tx.select().from(quoteRisks).where(eq(quoteRisks.quoteId, quoteId)).limit(1);
      if (!risk?.insuredGroupId) return { ok: false as const, message: "Cotización sin grupo asegurado" };

      const group = await insuredGroupRepository.findById(tx, risk.insuredGroupId);
      if (!group) return { ok: false as const, message: "Grupo asegurado no encontrado" };

      const client = await clientService.upsertByDocument(tx, {
        organizationId: session.organizationId,
        personType: "NATURAL",
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        executive: input.executive,
        vendor: input.vendor,
        assignedAgentId: quote.agentId,
      });
      if (client.id !== quote.clientId) {
        await tx.update(quotes).set({ clientId: client.id, updatedAt: new Date() }).where(eq(quotes.id, quoteId));
      }

      const existingMembers = await insuredGroupRepository.findMembers(tx, group.id);
      const titular = existingMembers.find((m) => m.relation === "TITULAR");
      const existingDependents = existingMembers.filter((m) => m.relation === "DEPENDIENTE");
      if (!titular) return { ok: false as const, message: "Titular no encontrado" };

      const titularChanged = titular.age !== input.titularAge || titular.gender !== input.titularGender;
      const regionChanged = group.region !== input.region;
      const dependentCountChanged = existingDependents.length !== desiredDependents.length;
      const dependentsChanged =
        dependentCountChanged ||
        existingDependents.some(
          (m, i) => m.age !== desiredDependents[i]?.age || m.gender !== desiredDependents[i]?.gender,
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
 * Precarga para "Editar" de una cotización de Salud. Mientras sigue
 * BORRADOR, trae TODO (región, dependientes incluidos) para la edición
 * completa (ver updateHealthQuote) — igual que Autos. Una vez enviada,
 * `full` queda en null y la página cae al formulario angosto de solo
 * cliente+titular (updateHealthQuoteClientInfo), que a diferencia de
 * Autos sigue dejando corregir edad/género ahí mismo (pedido explícito
 * de Delta), a costa de recalcular la comparativa si cambian.
 */
export async function getHealthQuoteClientForEdit(quoteId: string) {
  const session = await requirePermission("quote:create");
  requireBranch(session, "SALUD");

  return withOrganization(session.organizationId, async (tx) => {
    const quote = await healthQuoteService.findById(tx, quoteId);
    if (!quote || quote.branch !== "SALUD") return null;
    const client = await clientRepository.findById(tx, quote.clientId);
    if (!client) return null;

    const [risk] = await tx.select().from(quoteRisks).where(eq(quoteRisks.quoteId, quoteId)).limit(1);
    const titular = risk?.insuredGroupId ? await insuredGroupRepository.findTitular(tx, risk.insuredGroupId) : null;

    const clientInfo = {
      documentType: client.documentType,
      documentNumber: client.documentNumber,
      firstName: client.firstName,
      lastName: client.lastName,
      vendor: client.vendor,
    };
    const titularInfo = titular ? { age: titular.age, gender: titular.gender, birthDate: titular.birthDate } : null;

    let full = null;
    if (quote.status === "BORRADOR" && risk?.insuredGroupId) {
      const group = await insuredGroupRepository.findById(tx, risk.insuredGroupId);
      const members = await insuredGroupRepository.findMembers(tx, risk.insuredGroupId);
      const dependents = members
        .filter((m) => m.relation === "DEPENDIENTE")
        .map((m) => ({ age: m.age, gender: m.gender, birthDate: m.birthDate }));
      full = { region: group?.region ?? "SIERRA", dependents };
    }

    return {
      quoteId: quote.id,
      quoteCode: quote.code,
      client: clientInfo,
      titular: titularInfo,
      full,
    };
  });
}

/**
 * Guarda "Editar cliente" de Salud (ver getHealthQuoteClientForEdit). Si
 * edad o género del titular cambiaron, borra y vuelve a correr la
 * comparativa de ese riesgo con los valores nuevos — bloqueado si ya
 * salió una póliza (HealthComparisonError, health-comparison.service.ts).
 */
export async function updateHealthQuoteClientInfo(
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

  const parsed = editHealthClientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }

  let result: { ok: true; quoteId: string } | { ok: false; message: string };
  try {
    result = await withOrganization(session.organizationId, async (tx) => {
      const quote = await healthQuoteService.findById(tx, quoteId);
      if (!quote || quote.branch !== "SALUD") return { ok: false as const, message: "Cotización no encontrada" };

      await clientService.updateClientFields(tx, quote.clientId, {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
      });

      const [risk] = await tx.select().from(quoteRisks).where(eq(quoteRisks.quoteId, quoteId)).limit(1);
      const titular = risk?.insuredGroupId ? await insuredGroupRepository.findTitular(tx, risk.insuredGroupId) : null;

      if (risk && titular && (titular.age !== parsed.data.titularAge || titular.gender !== parsed.data.titularGender)) {
        await healthComparisonService.resetForRisk(tx, risk.id);
        await insuredGroupRepository.updateMember(tx, titular.id, {
          age: parsed.data.titularAge,
          gender: parsed.data.titularGender,
          birthDate: parsed.data.titularBirthDate ?? null,
        });
        await healthComparisonService.runComparisonForRisk(tx, session.organizationId, risk.id);

        await audit(tx, {
          organizationId: session.organizationId,
          userId: session.userId,
          action: "health_quote.titular_recomputed",
          entityType: "quotes",
          entityId: quote.id,
          metadata: { previousAge: titular.age, newAge: parsed.data.titularAge },
        });
      }

      await audit(tx, {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "quote.client_edited",
        entityType: "clients",
        entityId: quote.clientId,
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
  return { ok: true, value: { quoteId: result.quoteId } };
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
export async function listMyHealthQuotes() {
  const session = await requirePermission("quote:read");
  requireBranch(session, "SALUD");

  return withOrganization(session.organizationId, (tx) =>
    tx
      .select({
        id: quotes.id,
        code: quotes.code,
        status: quotes.status,
        operationType: quotes.operationType,
        createdAt: quotes.createdAt,
        documentNumber: clients.documentNumber,
      })
      .from(quotes)
      .innerJoin(clients, eq(clients.id, quotes.clientId))
      .where(and(eq(quotes.agentId, session.userId), eq(quotes.branch, "SALUD")))
      .orderBy(desc(quotes.createdAt))
      .limit(50),
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
