"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withOrganization } from "@/db";
import { quoteRisks } from "@/db/schema/quoting";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { clientService } from "@/domains/clients/services/client.service";
import { newClientVehicleSchema } from "@/domains/clients/schemas/client.schema";
import { quoteService } from "@/domains/quoting/services/quote.service";
import { comparisonService } from "@/domains/quoting/services/comparison.service";
import { dollarsToCents } from "@/domains/shared/money";
import { audit } from "@/domains/shared/audit";
import { rateLimit } from "@/lib/rate-limit";

export type ActionResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string[]> | { form: string[] } };

/**
 * Valida → llama al servicio de dominio → audita → revalida → redirige.
 * Nunca hay lógica de negocio acá — solo el pegamento entre formulario y
 * dominio (ARCHITECTURE.md §2).
 */
export async function createAutoQuote(
  _prevState: ActionResult<{ quoteId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ quoteId: string }>> {
  const session = await requirePermission("quote:create");
  await rateLimit(`quote:${session.userId}`, { limit: 30, window: "1 m" });

  const parsed = newClientVehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const input = parsed.data;

  const quoteId = await withOrganization(session.organizationId, async (tx) => {
    const { client, vehicle } = await clientService.createClientWithVehicle(
      tx,
      session.organizationId,
      session.userId,
      input,
    );

    const { quote, risk } = await quoteService.createAutoQuote(tx, {
      organizationId: session.organizationId,
      agentId: session.userId,
      clientId: client.id,
      vehicleId: vehicle.id,
      insuredValueCents: dollarsToCents(input.commercialValueDollars),
      extrasValueCents: dollarsToCents(input.extrasValueDollars),
      operationType: "NUEVA",
    });

    if (input.modality === "POR_KM") {
      await comparisonService.runKmComparisonForRisk(tx, session.organizationId, risk.id);
    } else {
      await comparisonService.runComparisonForRisk(tx, session.organizationId, risk.id);
    }

    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "quote.created",
      entityType: "quotes",
      entityId: quote.id,
    });

    return quote.id;
  });

  revalidatePath("/cotizar/autos");
  redirect(`/cotizar/autos/${quoteId}/comparar`);
}

const manualPremiumSchema = z.object({
  quoteOptionId: z.uuid(),
  quoteId: z.uuid(),
  netPremiumDollars: z.coerce.number().positive("La prima debe ser mayor a 0"),
});

/**
 * El ejecutivo digita la prima que le pasó la aseguradora — el mismo paso
 * manual de siempre, ver comparisonService.setManualPremium.
 */
export async function setManualPremium(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("quote:create");
  await rateLimit(`quote:${session.userId}`, { limit: 30, window: "1 m" });

  const parsed = manualPremiumSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const { quoteOptionId, quoteId, netPremiumDollars } = parsed.data;

  await withOrganization(session.organizationId, async (tx) => {
    await comparisonService.setManualPremium(
      tx,
      quoteOptionId,
      dollarsToCents(netPremiumDollars),
    );
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "quote_option.manual_premium_set",
      entityType: "quote_options",
      entityId: quoteOptionId,
    });
  });

  revalidatePath(`/cotizar/autos/${quoteId}/comparar`);
  return { ok: true, value: undefined };
}

export async function getQuoteComparison(quoteId: string) {
  const session = await requirePermission("quote:read");

  return withOrganization(session.organizationId, async (tx) => {
    const quote = await quoteService.findById(tx, quoteId);
    if (!quote) return null;

    const [risk] = await tx.select().from(quoteRisks).where(eq(quoteRisks.quoteId, quoteId));
    if (!risk) return null;

    const rows = await comparisonService.getComparisonForRisk(tx, risk.id);
    return { quote, rows };
  });
}
