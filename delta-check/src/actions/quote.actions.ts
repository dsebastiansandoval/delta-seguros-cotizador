"use server";

import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withOrganization } from "@/db";
import { quotes } from "@/db/schema/quoting";
import { vehicles } from "@/db/schema/clients";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { clientService } from "@/domains/clients/services/client.service";
import { newAutoQuoteSchema, type VehicleRiskInput } from "@/domains/clients/schemas/client.schema";
import { quoteService } from "@/domains/quoting/services/quote.service";
import { comparisonService } from "@/domains/quoting/services/comparison.service";
import { dollarsToCents } from "@/domains/shared/money";
import { audit } from "@/domains/shared/audit";
import { rateLimit } from "@/lib/rate-limit";

export type ActionResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string[]> | { form: string[] } };

/**
 * Crea cliente + vehículo(s) + cotización — común a "Guardar borrador" y
 * "Generar comparativa". `runComparison` es lo único que distingue una de
 * la otra: un borrador guarda los datos tal cual, sin gastar el cálculo de
 * las 13 aseguradoras todavía (el ejecutivo puede volver después).
 */
async function createQuoteFromForm(
  formData: FormData,
  session: { organizationId: string; userId: string },
  runComparison: boolean,
): Promise<ActionResult<{ quoteId: string }>> {
  const parsed = newAutoQuoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const input = parsed.data;

  const quoteId = await withOrganization(session.organizationId, async (tx) => {
    const { client, vehicles: createdVehicles } = await clientService.createClientWithVehicles(
      tx,
      session.organizationId,
      session.userId,
      input,
    );

    const { quote, risks } = await quoteService.createAutoQuote(tx, {
      organizationId: session.organizationId,
      agentId: session.userId,
      clientId: client.id,
      risks: createdVehicles.map((vehicle, i) => {
        const v: VehicleRiskInput = input.vehicles[i];
        return {
          vehicleId: vehicle.id,
          insuredValueCents: dollarsToCents(v.commercialValueDollars),
          extrasValueCents: dollarsToCents(v.extrasValueDollars),
        };
      }),
      modality: input.modality,
      operationType: input.operationType,
      previousInsurerId: input.previousInsurerId,
      previousPolicyNumber: input.previousPolicyNumber,
      previousExpiryDate: input.previousExpiryDate,
    });

    if (runComparison) {
      for (const risk of risks) {
        if (input.modality === "POR_KM") {
          await comparisonService.runKmComparisonForRisk(tx, session.organizationId, risk.id);
        } else {
          await comparisonService.runComparisonForRisk(tx, session.organizationId, risk.id);
        }
      }
    }

    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: runComparison ? "quote.created" : "quote.draft_saved",
      entityType: "quotes",
      entityId: quote.id,
      metadata: { risks: risks.length },
    });

    return quote.id;
  });

  return { ok: true, value: { quoteId } };
}

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

  const result = await createQuoteFromForm(formData, session, true);
  if (!result.ok) return result;

  revalidatePath("/cotizar/autos");
  redirect(`/cotizar/autos/${result.value.quoteId}/comparar`);
}

/**
 * "Guardar borrador" — mismos datos, sin correr el comparador todavía.
 * La cotización queda en `status: BORRADOR` (ya es el default) y aparece
 * en "Mis cotizaciones" para retomarla cuando el ejecutivo quiera.
 */
export async function saveAutoQuoteDraft(
  _prevState: ActionResult<{ quoteId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ quoteId: string }>> {
  const session = await requirePermission("quote:create");
  await rateLimit(`quote:${session.userId}`, { limit: 30, window: "1 m" });

  const result = await createQuoteFromForm(formData, session, false);
  if (!result.ok) return result;

  revalidatePath("/cotizar/autos");
  redirect(`/cotizar/autos`);
}

/**
 * "Generar comparativa" desde un borrador ya guardado (sin correr el
 * comparador al crearse) — retoma exactamente el paso que faltaba, sin
 * pedirle al agente que vuelva a escribir todo el formulario. Nunca
 * vuelve a correr un riesgo que ya tiene opciones — `runComparisonForRisk`
 * no es idempotente (insertaría filas duplicadas), así que se salta
 * cualquier riesgo con `rows.length > 0`.
 */
export async function runQuoteComparison(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("quote:create");
  await rateLimit(`quote:${session.userId}`, { limit: 30, window: "1 m" });

  const quoteId = formData.get("quoteId");
  if (typeof quoteId !== "string" || !quoteId) {
    return { ok: false, errors: { form: ["Cotización inválida"] } };
  }

  await withOrganization(session.organizationId, async (tx) => {
    const quote = await quoteService.findById(tx, quoteId);
    if (!quote) return;

    const risks = await quoteService.findRisksByQuote(tx, quoteId);
    for (const risk of risks) {
      const existing = await comparisonService.getComparisonForRisk(tx, risk.id);
      if (existing.length > 0) continue;

      if (quote.modality === "POR_KM") {
        await comparisonService.runKmComparisonForRisk(tx, session.organizationId, risk.id);
      } else {
        await comparisonService.runComparisonForRisk(tx, session.organizationId, risk.id);
      }
    }

    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "quote.comparison_generated",
      entityType: "quotes",
      entityId: quoteId,
    });
  });

  revalidatePath(`/cotizar/autos/${quoteId}/comparar`);
  return { ok: true, value: undefined };
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

/**
 * Una cotización puede traer 1 a 4 riesgos (vehículos) — se devuelve un
 * bloque de filas por cada uno, ya no una sola tabla plana. Si todavía no
 * se corrió el comparador (un borrador recién guardado), `rows` viene
 * vacío para ese riesgo — la página lo muestra como "sin cotizar todavía".
 */
export async function getQuoteComparison(quoteId: string) {
  const session = await requirePermission("quote:read");

  return withOrganization(session.organizationId, async (tx) => {
    const quote = await quoteService.findById(tx, quoteId);
    if (!quote) return null;

    const risks = await quoteService.findRisksByQuote(tx, quoteId);
    if (!risks.length) return null;

    const riskGroups = [];
    for (const risk of risks) {
      const [vehicle] = risk.vehicleId
        ? await tx.select().from(vehicles).where(eq(vehicles.id, risk.vehicleId))
        : [];
      const rows = await comparisonService.getComparisonForRisk(tx, risk.id);
      riskGroups.push({ risk, vehicle: vehicle ?? null, rows });
    }

    return { quote, riskGroups };
  });
}

/**
 * "Mis cotizaciones" — lo que le faltaba a "Guardar borrador" para no ser
 * un callejón sin salida: sin esto, guardar un borrador significa perder
 * la cotización de vista hasta acordarse de la URL exacta. Se filtra por
 * el propio agente, no por toda la organización — es una lista de trabajo
 * personal, no un reporte gerencial (para eso está quote:read_all en el
 * dashboard, ARCHITECTURE.md §14.1).
 */
export async function listMyAutoQuotes() {
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
      .where(and(eq(quotes.agentId, session.userId), eq(quotes.branch, "AUTOS")))
      .orderBy(desc(quotes.createdAt))
      .limit(50),
  );
}
