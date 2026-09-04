"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withOrganization } from "@/db";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { clientRepository } from "@/domains/clients/repositories/client.repository";
import { arcoService } from "@/domains/compliance/services/arco.service";
import {
  anonymizeClientSchema,
  createArcoRequestSchema,
  rectifyClientSchema,
  setMarketingOptOutSchema,
  updateArcoStatusSchema,
} from "@/domains/compliance/schemas/arco.schema";
import { audit } from "@/domains/shared/audit";
import type { ActionResult } from "./quote.actions";

/** Cualquier agente puede registrar el pedido que un cliente le hizo — mismo criterio que EMISION/SINIESTROS del Excel. */
export async function createArcoRequest(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("client:read_pii");

  const parsed = createArcoRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  const requestId = await withOrganization(session.organizationId, async (tx) => {
    const client = await clientRepository.findByDocument(tx, parsed.data.documentNumber);
    if (!client) {
      return null;
    }

    const request = await arcoService.createRequest(tx, {
      organizationId: session.organizationId,
      clientId: client.id,
      type: parsed.data.type,
      channel: parsed.data.channel,
      notes: parsed.data.notes,
      requestedByUserId: session.userId,
    });

    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "arco.request_created",
      entityType: "arco_requests",
      entityId: request.id,
      metadata: { type: parsed.data.type },
    });

    return request.id;
  });

  if (!requestId) {
    return { ok: false, errors: { form: ["No se encontró un cliente con ese documento"] } };
  }

  revalidatePath("/cumplimiento");
  redirect(`/cumplimiento/${requestId}`);
}

export async function rectifyClient(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("compliance:manage");

  const parsed = rectifyClientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  await withOrganization(session.organizationId, async (tx) => {
    await arcoService.rectifyClient(tx, parsed.data.clientId, {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      businessName: parsed.data.businessName,
      email: parsed.data.email,
      phone: parsed.data.phone,
    });
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "arco.client_rectified",
      entityType: "clients",
      entityId: parsed.data.clientId,
    });
    await arcoService.updateStatus(tx, parsed.data.requestId, {
      status: "COMPLETADA",
      resolutionNotes: "Datos rectificados",
      resolvedByUserId: session.userId,
    });
  });

  revalidatePath(`/cumplimiento/${parsed.data.requestId}`);
  return { ok: true, value: undefined };
}

export async function anonymizeClient(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("compliance:manage");

  const parsed = anonymizeClientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  await withOrganization(session.organizationId, async (tx) => {
    const { fullyAnonymized } = await arcoService.anonymizeClient(tx, parsed.data.clientId);
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "arco.client_anonymized",
      entityType: "clients",
      entityId: parsed.data.clientId,
      metadata: { fullyAnonymized },
    });
    await arcoService.updateStatus(tx, parsed.data.requestId, {
      status: "COMPLETADA",
      resolutionNotes: fullyAnonymized
        ? "Datos anonimizados por completo"
        : "Contacto anonimizado — nombre retenido por historial de pólizas (obligación legal de conservación)",
      resolvedByUserId: session.userId,
    });
  });

  revalidatePath(`/cumplimiento/${parsed.data.requestId}`);
  return { ok: true, value: undefined };
}

export async function setMarketingOptOut(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("compliance:manage");

  const parsed = setMarketingOptOutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  await withOrganization(session.organizationId, async (tx) => {
    await arcoService.setMarketingOptOut(tx, parsed.data.clientId, parsed.data.optOut);
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "arco.marketing_opt_out_set",
      entityType: "clients",
      entityId: parsed.data.clientId,
      metadata: { optOut: parsed.data.optOut },
    });
    await arcoService.updateStatus(tx, parsed.data.requestId, {
      status: "COMPLETADA",
      resolutionNotes: parsed.data.optOut ? "Cliente excluido de comunicaciones" : "Oposición revertida",
      resolvedByUserId: session.userId,
    });
  });

  revalidatePath(`/cumplimiento/${parsed.data.requestId}`);
  return { ok: true, value: undefined };
}

export async function updateArcoStatus(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("compliance:manage");

  const parsed = updateArcoStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  await withOrganization(session.organizationId, async (tx) => {
    await arcoService.updateStatus(tx, parsed.data.requestId, {
      status: parsed.data.status,
      resolutionNotes: parsed.data.resolutionNotes,
      resolvedByUserId: session.userId,
    });
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "arco.status_updated",
      entityType: "arco_requests",
      entityId: parsed.data.requestId,
      metadata: { status: parsed.data.status },
    });
  });

  revalidatePath(`/cumplimiento/${parsed.data.requestId}`);
  return { ok: true, value: undefined };
}

export async function listArcoRequests() {
  const session = await requirePermission("client:read_pii");
  return withOrganization(session.organizationId, (tx) => arcoService.list(tx));
}

export async function getArcoRequestDetail(requestId: string) {
  const session = await requirePermission("client:read_pii");
  return withOrganization(session.organizationId, (tx) => arcoService.getDetail(tx, requestId));
}

/** Acceso — exportar todo el dato crudo del titular (ARCHITECTURE.md §14). */
export async function exportClientData(clientId: string) {
  const session = await requirePermission("client:read_pii");
  const data = await withOrganization(session.organizationId, async (tx) => {
    const result = await arcoService.exportClientData(tx, clientId);
    await audit(tx, {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "arco.data_exported",
      entityType: "clients",
      entityId: clientId,
    });
    return result;
  });
  return data;
}
