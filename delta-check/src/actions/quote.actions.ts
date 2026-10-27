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
 * Precarga para `/cotizar/autos/[quoteId]/editar` — null si no existe o es
 * de otro ramo; `{ locked: true }` si ya no es BORRADOR (una vez enviada,
 * los datos quedan fijos — mismo criterio que "un borrador sin enviar no
 * es producción todavía", ARCHITECTURE.md §14.1).
 */
export async function getAutoQuoteForEdit(quoteId: string) {
  const session = await requirePermission("quote:create");
  requireBranch(session, "AUTOS");

  return withOrganization(session.organizationId, async (tx) => {
    const data = await quoteService.getEditData(tx, quoteId);
    if (!data || data.quote.branch !== "AUTOS") return null;
    if (data.quote.status !== "BORRADOR") return { locked: true as const };

    return {
      locked: false as const,
      quoteId: data.quote.id,
      quoteCode: data.quote.code,
      client: {
        personType: data.client.personType,
        documentType: data.client.documentType,
        documentNumber: data.client.documentNumber,
        firstName: data.client.firstName,
        lastName: data.client.lastName,
        businessName: data.client.businessName,
        birthDate: data.client.birthDate,
        maritalStatus: data.client.maritalStatus,
        gender: data.client.gender,
        source: data.client.source,
        executive: data.client.executive,
      },
      modality: data.quote.modality,
      operationType: data.quote.operationType,
      previousInsurerId: data.quote.previousInsurerId,
      previousPolicyNumber: data.quote.previousPolicyNumber,
      previousStartDate: data.quote.previousStartDate,
      previousExpiryDate: data.quote.previousExpiryDate,
      previousPremiumDollars:
        data.quote.previousPremiumCents != null ? data.quote.previousPremiumCents / 100 : null,
      risks: data.risks
        .filter((r) => r.vehicle)
        .map((r) => ({
          plate: r.vehicle!.plate,
          brand: r.vehicle!.brand,
          model: r.vehicle!.model,
          year: r.vehicle!.year,
          bodyType: r.vehicle!.bodyType as "LIVIANO" | "PICKUP",
          color: r.vehicle!.color,
          commercialValueDollars: r.vehicle!.commercialValueCents / 100,
          extrasValueDollars: r.vehicle!.extrasValueCents / 100,
          hasTracker: r.vehicle!.hasTracker,
          city: r.vehicle!.city,
          province: r.vehicle!.province,
        })),
    };
  });
}

/**
 * Corrige cliente + vehículo(s) de una cotización BORRADOR ya creada — lo
 * que le faltaba al flujo de "Generar comparativa": antes, volver atrás en
 * el navegador no ofrecía ninguna forma de corregir lo ya guardado (se veía
 * como si se hubiera perdido, aunque seguía intacto en la base). No cambia
 * el número de vehículos — eso exige una cotización nueva. Si ya se había
 * generado la comparativa, Latina/Cóndor se recalculan con los datos
 * nuevos (`repriceEngines`); las primas que el resto de aseguradoras ya
 * tenía digitadas a mano no se tocan — no hay forma de "recalcularlas"
 * nosotros, son cotizaciones manuales de otro portal.
 */
export async function updateAutoQuote(
  _prevState: ActionResult<{ quoteId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ quoteId: string }>> {
  const session = await requirePermission("quote:create");
  requireBranch(session, "AUTOS");
  await rateLimit(`quote:${session.userId}`, { limit: 30, window: "1 m" });

  const quoteId = formData.get("quoteId");
  if (typeof quoteId !== "string" || !quoteId) {
    return { ok: false, errors: { form: ["Cotización inválida"] } };
  }

  const parsed = newAutoQuoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const input = parsed.data;

  const result = await withOrganization(session.organizationId, async (tx) => {
    const quote = await quoteService.findById(tx, quoteId);
    if (!quote || quote.branch !== "AUTOS") return { ok: false as const, message: "Cotización no encontrada" };
    if (quote.status !== "BORRADOR") return { ok: false as const, message: "Esta cotización ya no se puede editar" };

    const risks = await quoteService.findRisksByQuote(tx, quoteId);
    if (risks.length !== input.vehicles.length) {
      return { ok: false as const, message: "No se puede cambiar el número de vehículos al editar — usa una cotización nueva" };
    }

    const client = await clientService.editClientAndVehicles(tx, session.organizationId, {
      personType: input.personType,
      documentType: input.documentType,
      documentNumber: input.documentNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      businessName: input.businessName,
      birthDate: input.birthDate,
      maritalStatus: input.maritalStatus,
      gender: input.gender,
      email: input.email,
      phone: input.phone,
      source: input.source,
      executive: input.executive,
      assignedAgentId: quote.agentId,
      vehicles: input.vehicles.map((v, i) => ({ ...v, vehicleId: risks[i].vehicleId })),
    });

    await quoteService.updateAutoQuote(tx, quoteId, {
      clientId: client.id,
      modality: input.modality,
      operationType: input.operationType,
      previousInsurerId: input.previousInsurerId,
      previousPolicyNumber: input.previousPolicyNumber,
      previousStartDate: input.previousStartDate,
      previousExpiryDate: input.previousExpiryDate,
      previousPremiumCents: input.previousPremiumDollars != null ? dollarsToCents(input.previousPremiumDollars) : undefined,
      risks: risks.map((r, i) => ({
        quoteRiskId: r.id,
        insuredValueCents: dollarsToCents(input.vehicles[i].commercialValueDollars),
        extrasValueCents: dollarsToCents(input.vehicles[i].extrasValueDollars),
      })),
    });

    if (risks.length && (await comparisonService.hasOptions(tx, risks[0].id))) {
      await comparisonService.repriceEngines(tx, quoteId);
    }

    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "quote.edited",
      entityType: "quotes",
      entityId: quoteId,
    });

    return { ok: true as const };
  });

  if (!result.ok) return { ok: false, errors: { form: [result.message] } };

  revalidatePath("/cotizar/autos");
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
