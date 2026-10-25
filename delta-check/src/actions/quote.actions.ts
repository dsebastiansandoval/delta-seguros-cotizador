"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withOrganization, type Db } from "@/db";
import { quotes } from "@/db/schema/quoting";
import { requireBranch, requirePermission } from "@/domains/identity/services/rbac.service";
import { clientService } from "@/domains/clients/services/client.service";
import { newAutoQuoteSchema, type VehicleRiskInput } from "@/domains/clients/schemas/client.schema";
import { quoteService } from "@/domains/quoting/services/quote.service";
import { comparisonService } from "@/domains/quoting/services/comparison.service";
import { offerService } from "@/domains/quoting/offer/offer.service";
import { dollarsToCents } from "@/domains/shared/money";
import { audit } from "@/domains/shared/audit";
import { rateLimit } from "@/lib/rate-limit";

export type ActionResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string[]> | { form: string[] } };

/**
 * Filas por aseguradora × riesgo para los riesgos que todavía no las tienen,
 * configuración inicial de DATOS OFERTA y precios de Latina/Cóndor. Saltar
 * riesgos ya generados lo hace seguro de repetir desde un borrador.
 */
async function generateComparison(
  tx: Db,
  organizationId: string,
  quoteId: string,
  modality: "ANUAL" | "POR_KM",
  risks: Array<{ id: string }>,
) {
  for (const risk of risks) {
    if (await comparisonService.hasOptions(tx, risk.id)) continue;
    if (modality === "POR_KM") {
      await comparisonService.runKmComparisonForRisk(tx, organizationId, risk.id);
    } else {
      await comparisonService.createOptionsForRisk(tx, organizationId, risk.id);
    }
  }
  await offerService.ensureSettings(tx, organizationId, quoteId);
  await comparisonService.repriceEngines(tx, quoteId);
  await offerService.includePricedInsurers(tx, quoteId);
}

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
      ...(input.operationType === "RENOVACION" && {
        previousInsurerId: input.previousInsurerId,
        previousPolicyNumber: input.previousPolicyNumber,
        previousStartDate: input.previousStartDate,
        previousExpiryDate: input.previousExpiryDate,
        previousPremiumCents:
          input.previousPremiumDollars != null ? dollarsToCents(input.previousPremiumDollars) : undefined,
      }),
    });

    if (runComparison) {
      await generateComparison(tx, session.organizationId, quote.id, input.modality, risks);
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
  requireBranch(session, "AUTOS");
  await rateLimit(`quote:${session.userId}`, { limit: 30, window: "1 m" });

  const result = await createQuoteFromForm(formData, session, true);
  if (!result.ok) return result;

  revalidatePath("/cotizar/autos");
  redirect(`/cotizar/autos/${result.value.quoteId}/configurar`);
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
  requireBranch(session, "AUTOS");
  await rateLimit(`quote:${session.userId}`, { limit: 30, window: "1 m" });

  const result = await createQuoteFromForm(formData, session, false);
  if (!result.ok) return result;

  revalidatePath("/cotizar/autos");
  redirect(`/cotizar/autos`);
}

/**
 * "Generar comparativa" desde un borrador ya guardado — retoma el paso que
 * faltaba sin pedirle al agente que vuelva a escribir el formulario, y lo
 * lleva a configurar la oferta.
 */
export async function runQuoteComparison(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("quote:create");
  requireBranch(session, "AUTOS");
  await rateLimit(`quote:${session.userId}`, { limit: 30, window: "1 m" });

  const quoteId = formData.get("quoteId");
  if (typeof quoteId !== "string" || !quoteId) {
    return { ok: false, errors: { form: ["Cotización inválida"] } };
  }

  const found = await withOrganization(session.organizationId, async (tx) => {
    const quote = await quoteService.findById(tx, quoteId);
    if (!quote) return false;

    const risks = await quoteService.findRisksByQuote(tx, quoteId);
    await generateComparison(tx, session.organizationId, quoteId, quote.modality, risks);

    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "quote.comparison_generated",
      entityType: "quotes",
      entityId: quoteId,
    });
    return true;
  });
  if (!found) return { ok: false, errors: { form: ["Cotización no encontrada"] } };

  redirect(`/cotizar/autos/${quoteId}/configurar`);
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
  requireBranch(session, "AUTOS");

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
