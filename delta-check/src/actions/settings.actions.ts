"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type Db, withOrganization } from "@/db";
import { FormListError, formListsService, type FormListKind } from "@/domains/clients/services/form-lists.service";
import { type AuthorizedSession, requirePermission } from "@/domains/identity/services/rbac.service";
import { engineRatesSchema, firstIssue } from "@/domains/quoting/schemas/engine-rates.schema";
import { engineRatesService } from "@/domains/quoting/services/engine-rates.service";
import { audit } from "@/domains/shared/audit";
import type { ActionResult } from "./quote.actions";

const PATH = "/admin/configuracion";

// Listas del formulario: quién aparece como EJECUTIVO/FUENTE es parte de la nómina → user:manage.
// Tablas de tasas → rate:edit, el mismo permiso que la carga de tarifas de Salud.

const kindSchema = z.enum(["executives", "sources"]) satisfies z.ZodType<FormListKind>;
const ENTITY_TYPE: Record<FormListKind, string> = { executives: "quote_executives", sources: "quote_sources" };

const nameSchema = z
  .string()
  .trim()
  .min(1, "Ingresa el nombre")
  .max(80, "Nombre muy largo")
  .transform((s) => s.replace(/\s+/g, " ").toUpperCase());

export async function getSettingsOverview() {
  const session = await requirePermission("quote:read");
  const canManageLists = session.permissions.has("user:manage");
  const canEditRates = session.permissions.has("rate:edit");
  return withOrganization(session.organizationId, async (tx) => ({
    lists: canManageLists
      ? { executives: await formListsService.list(tx, "executives"), sources: await formListsService.list(tx, "sources") }
      : null,
    engineRates: canEditRates ? await engineRatesService.get(tx) : null,
  }));
}

/** Corre un cambio de lista con permiso, tenant y auditoría; los FormListError vuelven como mensaje. */
async function changeList(
  formData: FormData,
  change: (tx: Db, session: AuthorizedSession, kind: FormListKind) => Promise<{ action: string; entityId: string; metadata?: Record<string, unknown> }>,
): Promise<ActionResult> {
  const session = await requirePermission("user:manage");
  const kind = kindSchema.safeParse(formData.get("kind"));
  if (!kind.success) return { ok: false, errors: { form: ["Lista inválida"] } };

  try {
    await withOrganization(session.organizationId, async (tx) => {
      const event = await change(tx, session, kind.data);
      await audit(tx, {
        organizationId: session.organizationId,
        userId: session.userId,
        action: event.action,
        entityType: ENTITY_TYPE[kind.data],
        entityId: event.entityId,
        metadata: event.metadata,
      });
    });
  } catch (error) {
    if (error instanceof FormListError || error instanceof z.ZodError) {
      return { ok: false, errors: { form: [error instanceof z.ZodError ? firstIssue(error) : error.message] } };
    }
    throw error;
  }
  revalidatePath(PATH);
  return { ok: true, value: undefined };
}

export async function createFormListItem(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return changeList(formData, async (tx, session, kind) => {
    const name = nameSchema.parse(formData.get("name"));
    const row = await formListsService.create(tx, session.organizationId, kind, name);
    return { action: "settings.list_item_created", entityId: row.id, metadata: { name } };
  });
}

export async function updateFormListItem(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return changeList(formData, async (tx, _session, kind) => {
    const id = z.uuid().parse(formData.get("id"));
    const name = nameSchema.parse(formData.get("name"));
    const isActive = formData.get("isActive") === "on";
    await formListsService.update(tx, kind, { id, name, isActive });
    return { action: "settings.list_item_updated", entityId: id, metadata: { name, isActive } };
  });
}

export async function moveFormListItem(formData: FormData): Promise<void> {
  await changeList(formData, async (tx, _session, kind) => {
    const id = z.uuid().parse(formData.get("id"));
    const direction = z.enum(["up", "down"]).parse(formData.get("direction"));
    await formListsService.move(tx, kind, id, direction);
    return { action: "settings.list_item_moved", entityId: id, metadata: { direction } };
  });
}

/** Las tablas llegan como JSON armado por el editor (tasas como fracción, igual que el Excel). */
export async function saveEngineRates(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("rate:edit");

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("rates") ?? ""));
  } catch {
    return { ok: false, errors: { form: ["Datos inválidos"] } };
  }
  const parsed = engineRatesSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: { form: [firstIssue(parsed.error)] } };

  await withOrganization(session.organizationId, async (tx) => {
    await engineRatesService.save(tx, session.organizationId, session.userId, parsed.data);
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "settings.engine_rates_updated",
      entityType: "organization_settings",
      metadata: parsed.data,
    });
  });
  revalidatePath(PATH);
  return { ok: true, value: undefined };
}

export async function resetEngineRates(): Promise<void> {
  const session = await requirePermission("rate:edit");
  await withOrganization(session.organizationId, async (tx) => {
    await engineRatesService.reset(tx);
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "settings.engine_rates_reset",
      entityType: "organization_settings",
    });
  });
  revalidatePath(PATH);
}
