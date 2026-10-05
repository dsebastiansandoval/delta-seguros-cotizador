"use server";

import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withOrganization } from "@/db";
import { quoteRisks, quotes } from "@/db/schema/quoting";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { clientRepository } from "@/domains/clients/repositories/client.repository";
import { newHealthQuoteSchema, MAX_DEPENDENTS } from "@/domains/health/schemas/health-quote.schema";
import { healthQuoteService, type NewMemberInput } from "@/domains/health/services/health-quote.service";
import { healthComparisonService } from "@/domains/health/services/health-comparison.service";
import { audit } from "@/domains/shared/audit";
import { dollarsToCents } from "@/domains/shared/money";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "./quote.actions";

export async function createHealthQuote(
  _prevState: ActionResult<{ quoteId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ quoteId: string }>> {
  const session = await requirePermission("quote:create");
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
    const existing = await clientRepository.findByDocument(tx, input.documentNumber);
    const client =
      existing ??
      (await clientRepository.create(tx, {
        organizationId: session.organizationId,
        personType: input.personType,
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        source: input.source,
        executive: input.executive,
        assignedAgentId: session.userId,
      }));

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
  redirect(`/cotizar/salud/${quoteId}/comparar`);
}

const manualHealthPremiumSchema = z.object({
  quoteOptionId: z.uuid(),
  quoteId: z.uuid(),
  totalPremiumDollars: z.coerce.number().positive("La prima debe ser mayor a 0"),
});

export async function setManualHealthPremium(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("quote:create");
  await rateLimit(`quote:${session.userId}`, { limit: 30, window: "1 m" });

  const parsed = manualHealthPremiumSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  const { quoteOptionId, quoteId, totalPremiumDollars } = parsed.data;

  await withOrganization(session.organizationId, async (tx) => {
    await healthComparisonService.setManualPremium(tx, quoteOptionId, dollarsToCents(totalPremiumDollars));
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "quote_option.manual_premium_set",
      entityType: "quote_options",
      entityId: quoteOptionId,
    });
  });

  revalidatePath(`/cotizar/salud/${quoteId}/comparar`);
  return { ok: true, value: undefined };
}

/**
 * "Mis cotizaciones" de Salud — mismo patrón exacto que
 * `listMyAutoQuotes()` (quote.actions.ts): lista de trabajo personal del
 * agente (filtra por `agentId`, no toda la organización), no un reporte
 * gerencial.
 */
export async function listMyHealthQuotes() {
  const session = await requirePermission("quote:read");

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

  return withOrganization(session.organizationId, async (tx) => {
    const quote = await healthQuoteService.findById(tx, quoteId);
    if (!quote) return null;

    const [risk] = await tx.select().from(quoteRisks).where(eq(quoteRisks.quoteId, quoteId));
    if (!risk) return null;

    const rows = await healthComparisonService.getComparisonForRisk(tx, risk.id);
    return { quote, rows };
  });
}
