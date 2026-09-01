import { auditLogs } from "@/db/schema";
import type { Db } from "@/db";

/**
 * ARCHITECTURE.md §9 — cada acción crítica (cotizar, emitir, cancelar,
 * exportar, ver PII) se registra acá. Recibe `tx` explícito porque siempre
 * se llama desde dentro de un withOrganization() (ver src/db/index.ts): la
 * fila de auditoría lleva el mismo organization_id que la operación que
 * audita, dentro de la misma transacción.
 */
export async function audit(
  tx: Db,
  params: {
    organizationId: string;
    userId: string | null;
    action: string;
    entityType: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.insert(auditLogs).values({
    organizationId: params.organizationId,
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: params.metadata,
  });
}
