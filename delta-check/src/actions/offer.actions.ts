"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withOrganization } from "@/db";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import {
  OfferConfigurationError,
  offerService,
  type SettingsInput,
} from "@/domains/quoting/offer/offer.service";
import { dollarsToCents } from "@/domains/shared/money";
import { audit } from "@/domains/shared/audit";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "./quote.actions";

export async function getOfferConfiguration(quoteId: string) {
  const session = await requirePermission("quote:read");
  return withOrganization(session.organizationId, (tx) => offerService.getConfiguration(tx, quoteId));
}

export async function getOfferSheet(quoteId: string) {
  const session = await requirePermission("quote:read");
  return withOrganization(session.organizationId, (tx) => offerService.getOfferSheet(tx, quoteId));
}

const uuid = z.uuid();
const money = z.union([z.literal(""), z.coerce.number().nonnegative()]);
const coverageType = z.enum(["TODO_RIESGO", "SOLO_PERDIDA_TOTAL"]);

// El navegador envía los saltos de línea de un <option> como \r\n; el perfil usa \n.
function text(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" && value !== "" ? value.replace(/\r\n/g, "\n") : null;
}

function cents(formData: FormData, name: string): number | null {
  const parsed = money.safeParse(formData.get(name) ?? "");
  if (!parsed.success) throw new OfferConfigurationError("Monto inválido");
  return parsed.data === "" ? null : dollarsToCents(parsed.data);
}

/** Lee la grilla de DATOS OFERTA: campos `<campo>:<insurerId>` y `premium:<quoteOptionId>`. */
function parseConfiguration(formData: FormData) {
  const settings: SettingsInput[] = formData.getAll("insurerId").map((raw) => {
    const insurerId = uuid.parse(raw);
    const vs = text(formData, `partialVs:${insurerId}`);
    const va = text(formData, `partialVa:${insurerId}`);
    const min = text(formData, `partialMin:${insurerId}`);
    return {
      insurerId,
      included: formData.get(`included:${insurerId}`) === "on",
      coverageType: coverageType.parse(formData.get(`coverageType:${insurerId}`) ?? "TODO_RIESGO"),
      amparoPatrimonial: formData.get(`amparo:${insurerId}`) === "on",
      rcAmountCents: cents(formData, `rc:${insurerId}`),
      gmAmountCents: cents(formData, `gm:${insurerId}`),
      partialDeductible: vs && va && min ? `${vs}${va}${min}` : text(formData, `partial:${insurerId}`),
      totalLossDeductible: text(formData, `totalLoss:${insurerId}`),
    };
  });

  const premiums = formData.getAll("premiumOptionId").map((raw) => {
    const quoteOptionId = uuid.parse(raw);
    const premiumCents = cents(formData, `premium:${quoteOptionId}`);
    if (premiumCents === 0) throw new OfferConfigurationError("La prima debe ser mayor a 0");
    return { quoteOptionId, premiumCents };
  });

  return { settings, premiums };
}

/** Guarda DATOS OFERTA (configuración + primas) y lleva a la comparativa en formato OFERTA. */
export async function saveOfferConfiguration(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("quote:create");
  await rateLimit(`quote:${session.userId}`, { limit: 30, window: "1 m" });

  const quoteId = uuid.safeParse(formData.get("quoteId"));
  if (!quoteId.success) return { ok: false, errors: { form: ["Cotización inválida"] } };

  try {
    const input = parseConfiguration(formData);
    await withOrganization(session.organizationId, async (tx) => {
      await offerService.saveConfiguration(tx, quoteId.data, input);
      await audit(tx, {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "quote.offer_configured",
        entityType: "quotes",
        entityId: quoteId.data,
        metadata: { insurers: input.settings.filter((s) => s.included).length },
      });
    });
  } catch (error) {
    if (error instanceof OfferConfigurationError || error instanceof z.ZodError) {
      return { ok: false, errors: { form: [error instanceof OfferConfigurationError ? error.message : "Datos inválidos"] } };
    }
    throw error;
  }

  revalidatePath(`/cotizar/autos/${quoteId.data}/comparar`);
  if (formData.get("intent") === "save") {
    revalidatePath(`/cotizar/autos/${quoteId.data}/configurar`);
    return { ok: true, value: undefined };
  }
  redirect(`/cotizar/autos/${quoteId.data}/comparar`);
}
