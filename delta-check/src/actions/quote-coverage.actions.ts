"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withOrganization } from "@/db";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { quoteCoverageService } from "@/domains/quoting/services/quote-coverage.service";
import { dollarsToCents } from "@/domains/shared/money";
import { audit } from "@/domains/shared/audit";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "./quote.actions";

/**
 * Grilla "Sí otorga"/montos por aseguradora (ítem 8 del feedback — la
 * UI de captura manual que faltaba, ARCHITECTURE.md §30). Mismo permiso
 * que `setManualPremium`: cualquiera que pueda cotizar puede cargar esto,
 * no hace falta un rol nuevo.
 */
export async function getQuoteOptionCoverages(quoteOptionId: string) {
  const session = await requirePermission("quote:read");
  return withOrganization(session.organizationId, async (tx) => {
    const context = await quoteCoverageService.getContext(tx, quoteOptionId);
    if (!context || !session.branches.has(context.branch)) return null;
    const coverages = await quoteCoverageService.listForOption(tx, quoteOptionId, context.branch);
    return { context, coverages };
  });
}

const saveSchema = z.object({ quoteOptionId: z.uuid() });

/**
 * Una fila por cobertura, con el nombre de campo codificando el tipo real
 * (`granted_{id}`/`amount_{id}`/`text_{id}`) — no un Zod object fijo como
 * `riskShape` en client.schema.ts, porque el catálogo de 18 coberturas es
 * un dato de la base, no algo que TypeScript pueda conocer en tiempo de
 * compilación. Se revalida cada tipo contra el catálogo real (traído de
 * nuevo acá, no confiado del formulario) antes de guardar.
 */
export async function saveQuoteOptionCoverages(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("quote:create");
  await rateLimit(`quote:${session.userId}`, { limit: 30, window: "1 m" });

  const parsed = saveSchema.safeParse({ quoteOptionId: formData.get("quoteOptionId") });
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  const { quoteOptionId } = parsed.data;

  const context = await withOrganization(session.organizationId, async (tx) => {
    const ctx = await quoteCoverageService.getContext(tx, quoteOptionId);
    if (!ctx || !session.branches.has(ctx.branch)) return null;

    const catalogRows = await quoteCoverageService.listForOption(tx, quoteOptionId, ctx.branch);
    const entries = catalogRows.map((row) => {
      if (row.valueType === "BOOLEAN") {
        return { coverageId: row.coverageId, granted: formData.get(`granted_${row.coverageId}`) === "on", amountCents: null, textValue: null };
      }
      if (row.valueType === "AMOUNT") {
        const dollars = Number(formData.get(`amount_${row.coverageId}`) ?? 0);
        const granted = Number.isFinite(dollars) && dollars > 0;
        return { coverageId: row.coverageId, granted, amountCents: granted ? dollarsToCents(dollars) : null, textValue: null };
      }
      // TEXT — "No otorga" escrito a mano cuenta como no otorgada, igual
      // que el ejemplo real de Delta (columna "Auto sustituto: No otorga").
      const raw = String(formData.get(`text_${row.coverageId}`) ?? "").trim();
      return { coverageId: row.coverageId, granted: raw.length > 0 && raw.toUpperCase() !== "NO OTORGA", amountCents: null, textValue: raw || null };
    });

    await quoteCoverageService.saveForOption(tx, session.organizationId, quoteOptionId, entries);
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "quote_option.coverages_set",
      entityType: "quote_options",
      entityId: quoteOptionId,
      metadata: { count: entries.length },
    });
    return ctx;
  });

  if (!context) return { ok: false, errors: { form: ["No se encontró la opción de cotización"] } };

  const branchPath = context.branch === "SALUD" ? "salud" : "autos";
  revalidatePath(`/cotizar/${branchPath}/${context.quoteId}/opciones/${quoteOptionId}/coberturas`);
  revalidatePath(`/cotizar/${branchPath}/${context.quoteId}/comparar`);
  return { ok: true, value: undefined };
}
