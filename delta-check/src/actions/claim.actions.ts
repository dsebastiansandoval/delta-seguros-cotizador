"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withOrganization } from "@/db";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { claimService } from "@/domains/policies/services/claim.service";
import { claimAttachmentService } from "@/domains/policies/services/claim-attachment.service";
import { addClaimNoteSchema, reportClaimSchema, updateClaimStatusSchema } from "@/domains/policies/schemas/policy.schema";
import { audit } from "@/domains/shared/audit";
import { sendClaimNoteNotification } from "@/lib/email";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { attachmentsEnabled, createAttachmentDownloadUrl, createAttachmentUploadUrl, deleteAttachmentObject } from "@/lib/s3";
import type { ActionResult } from "./quote.actions";

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20 MB — generoso para fotos/facturas escaneadas, sin abrir la puerta a videos enteros

export async function reportClaim(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("claim:manage");
  await rateLimit(`claim:${session.userId}`, { limit: 30, window: "1 m" });

  const parsed = reportClaimSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  await withOrganization(session.organizationId, async (tx) => {
    const claim = await claimService.report(tx, session.organizationId, parsed.data);
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "claim.reported",
      entityType: "claims",
      entityId: claim.id,
    });
  });

  revalidatePath("/siniestros");
  redirect("/siniestros");
}

export async function updateClaimStatus(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("claim:manage");

  const parsed = updateClaimStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  await withOrganization(session.organizationId, async (tx) => {
    await claimService.updateStatus(tx, session.organizationId, parsed.data.claimId, parsed.data.status, session.userId);
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "claim.status_updated",
      entityType: "claims",
      entityId: parsed.data.claimId,
      metadata: { status: parsed.data.status },
    });
  });

  revalidatePath("/siniestros");
  revalidatePath(`/siniestros/${parsed.data.claimId}`);
  return { ok: true, value: undefined };
}

/** Novedad escrita a mano — el "chat"/historial del siniestro que hoy se lleva en un Excel compartido. */
export async function addClaimNote(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("claim:manage");
  await rateLimit(`claim-note:${session.userId}`, { limit: 60, window: "1 m" });

  const parsed = addClaimNoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  const claimLabel = await withOrganization(session.organizationId, async (tx) => {
    const event = await claimService.addNote(tx, session.organizationId, parsed.data.claimId, session.userId, parsed.data.note);
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "claim.note_added",
      entityType: "claim_events",
      entityId: event.id,
    });
    return parsed.data.notifyEmail ? claimService.getLabel(tx, parsed.data.claimId) : null;
  });

  // Correo afuera de la transacción, mismo criterio que sendPasswordSetupEmail
  // en user.actions.ts — la novedad ya quedó guardada, un correo caído no la deshace.
  if (parsed.data.notifyEmail && claimLabel) {
    await sendClaimNoteNotification({
      to: parsed.data.notifyEmail,
      claimLabel,
      authorName: session.fullName ?? "Alguien del equipo",
      note: parsed.data.note,
      claimUrl: `${env.APP_URL}/siniestros/${parsed.data.claimId}`,
    });
  }

  revalidatePath(`/siniestros/${parsed.data.claimId}`);
  return { ok: true, value: undefined };
}

/** Sin `search`: solo vigentes. Con `search`: busca en todos los estados, incluye entregados. */
export async function listClaims(search?: string) {
  const session = await requirePermission("quote:read");
  return withOrganization(session.organizationId, (tx) => claimService.list(tx, [...session.branches], search));
}

/** Detalle + historial de novedades, para /siniestros/[claimId] — mismo patrón de chequeo de ramo que getPolicyDetail. */
export async function getClaimDetail(claimId: string) {
  const session = await requirePermission("quote:read");
  const detail = await withOrganization(session.organizationId, (tx) => claimService.getDetail(tx, claimId));
  return detail && session.branches.has(detail.claim.branch) ? detail : null;
}

/**
 * Adjuntos de un siniestro (Workstream E.5) — sanitiza el nombre pero NO
 * valida tipo de archivo: son fotos/facturas/informes de taller, variados
 * a propósito. `attachmentsEnabled` en falso (sin credenciales de AWS
 * configuradas) hace que esto devuelva `null` en vez de romper la página.
 */
export async function listClaimAttachments(claimId: string) {
  if (!attachmentsEnabled) return null;
  const session = await requirePermission("quote:read");
  return withOrganization(session.organizationId, async (tx) => {
    const branch = await claimService.getBranch(tx, claimId);
    if (!branch || !session.branches.has(branch)) return null;
    return claimAttachmentService.list(tx, claimId);
  });
}

/**
 * Paso 1 de subir un adjunto: devuelve una URL firmada de PUT a S3 — el
 * navegador sube el archivo directo a S3 (nunca pasa por esta función ni
 * por el servidor de Next, evita el límite de tamaño de una Server
 * Action). El cliente completa con `confirmClaimAttachment` una vez que el
 * PUT a esa URL responde 200.
 */
export async function createClaimAttachmentUploadUrl(
  claimId: string,
  fileName: string,
  contentType: string,
  sizeBytes: number,
): Promise<{ ok: true; uploadUrl: string; s3Key: string } | { ok: false; message: string }> {
  if (!attachmentsEnabled) return { ok: false, message: "Adjuntos no configurados (falta AWS)" };
  if (sizeBytes > MAX_ATTACHMENT_BYTES) return { ok: false, message: "El archivo supera los 20 MB" };

  await requirePermission("claim:manage");

  const safeName = fileName.replace(/[^\w.\-]+/g, "_").slice(-150);
  const s3Key = `claims/${claimId}/${crypto.randomUUID()}-${safeName}`;

  const uploadUrl = await createAttachmentUploadUrl(s3Key, contentType);
  if (!uploadUrl) return { ok: false, message: "No se pudo generar la URL de subida" };
  return { ok: true, uploadUrl, s3Key };
}

/** Paso 2: ya subido el archivo a S3, guarda la metadata y la deja en el historial. */
export async function confirmClaimAttachment(input: {
  claimId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  s3Key: string;
}): Promise<ActionResult<{ attachmentId: string }>> {
  const session = await requirePermission("claim:manage");

  const attachment = await withOrganization(session.organizationId, async (tx) => {
    const created = await claimAttachmentService.create(tx, session.organizationId, {
      claimId: input.claimId,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      s3Key: input.s3Key,
      uploadedByUserId: session.userId,
    });
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "claim.attachment_uploaded",
      entityType: "claim_attachments",
      entityId: created.id,
      metadata: { fileName: input.fileName },
    });
    return created;
  });

  revalidatePath(`/siniestros/${input.claimId}`);
  return { ok: true, value: { attachmentId: attachment.id } };
}

/** URL firmada de descarga, generada al vuelo (nunca se guarda una URL pública ni permanente). */
export async function getClaimAttachmentDownloadUrl(attachmentId: string): Promise<string | null> {
  if (!attachmentsEnabled) return null;
  const session = await requirePermission("quote:read");

  return withOrganization(session.organizationId, async (tx) => {
    const attachment = await claimAttachmentService.getOne(tx, attachmentId);
    if (!attachment) return null;
    const branch = await claimService.getBranch(tx, attachment.claimId);
    if (!branch || !session.branches.has(branch)) return null;
    return createAttachmentDownloadUrl(attachment.s3Key);
  });
}

/**
 * Borra un adjunto — mismo permiso que subirlo (`claim:manage`, no solo
 * `quote:read` como la descarga). Primero el objeto en S3, después la fila
 * de metadata: si el borrado en S3 falla, mejor quedarse con metadata
 * huérfana (se puede reintentar) que con un objeto en S3 sin fila que lo
 * referencie (imposible de encontrar de nuevo).
 */
export async function deleteClaimAttachment(attachmentId: string): Promise<ActionResult> {
  if (!attachmentsEnabled) return { ok: false, errors: { form: ["Adjuntos no configurados"] } };
  const session = await requirePermission("claim:manage");

  const result = await withOrganization(session.organizationId, async (tx) => {
    const attachment = await claimAttachmentService.getOne(tx, attachmentId);
    if (!attachment) return { ok: false as const, message: "Adjunto no encontrado" };
    const branch = await claimService.getBranch(tx, attachment.claimId);
    if (!branch || !session.branches.has(branch)) return { ok: false as const, message: "Adjunto no encontrado" };

    await deleteAttachmentObject(attachment.s3Key);
    await claimAttachmentService.delete(tx, attachmentId);
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "claim.attachment_deleted",
      entityType: "claim_attachments",
      entityId: attachmentId,
      metadata: { fileName: attachment.fileName },
    });
    return { ok: true as const, claimId: attachment.claimId };
  });

  if (!result.ok) return { ok: false, errors: { form: [result.message] } };
  revalidatePath(`/siniestros/${result.claimId}`);
  return { ok: true, value: undefined };
}
