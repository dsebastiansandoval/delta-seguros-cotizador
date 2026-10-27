"use server";

import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withOrganization } from "@/db";
import { quoteRisks, quotes } from "@/db/schema/quoting";
import { requireBranch, requirePermission } from "@/domains/identity/services/rbac.service";
import { clientService } from "@/domains/clients/services/client.service";
import { newHealthQuoteSchema, MAX_DEPENDENTS } from "@/domains/health/schemas/health-quote.schema";
import { healthQuoteService, type NewMemberInput } from "@/domains/health/services/health-quote.service";
import { healthComparisonService } from "@/domains/health/services/health-comparison.service";
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

  const members: NewMemberInput[] = [{ relation: "TITULAR", age: input.titularAge, gender: input.titularGender }];
  for (let i = 1; i <= MAX_DEPENDENTS; i++) {
    const age = input[`dep${i}Age` as keyof typeof input] as number | undefined;
    const gender = input[`dep${i}Gender` as keyof typeof input] as "MASCULINO" | "FEMENINO" | undefined;
    if (age != null && gender) members.push({ relation: "DEPENDIENTE", age, gender });
  }

  const quoteId = await withOrganization(session.organizationId, async (tx) => {
    const client = await clientService.upsertByDocument(tx, {
      organizationId: session.organizationId,
      personType: "NATURAL",
      documentType: input.documentType,
      documentNumber: input.documentNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      source: input.source,
      executive: input.executive,
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
      })
      .from(quotes)
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
