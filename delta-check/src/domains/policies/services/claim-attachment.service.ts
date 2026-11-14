import { desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { claimAttachments } from "@/db/schema/policies";
import { users } from "@/db/schema/identity";

/** Metadata de adjuntos de un siniestro — el archivo vive en S3, ver `src/lib/s3.ts`. */
export const claimAttachmentService = {
  async create(
    tx: Db,
    organizationId: string,
    input: { claimId: string; fileName: string; contentType: string; sizeBytes: number; s3Key: string; uploadedByUserId: string },
  ) {
    const [attachment] = await tx.insert(claimAttachments).values({ organizationId, ...input }).returning();
    return attachment;
  },

  async list(tx: Db, claimId: string) {
    return tx
      .select({
        id: claimAttachments.id,
        fileName: claimAttachments.fileName,
        contentType: claimAttachments.contentType,
        sizeBytes: claimAttachments.sizeBytes,
        s3Key: claimAttachments.s3Key,
        createdAt: claimAttachments.createdAt,
        uploadedByName: users.fullName,
      })
      .from(claimAttachments)
      .leftJoin(users, eq(users.id, claimAttachments.uploadedByUserId))
      .where(eq(claimAttachments.claimId, claimId))
      .orderBy(desc(claimAttachments.createdAt));
  },

  async getOne(tx: Db, attachmentId: string) {
    const [row] = await tx.select().from(claimAttachments).where(eq(claimAttachments.id, attachmentId));
    return row ?? null;
  },

  /** Borra solo la fila de metadata — el objeto en S3 lo borra quien llama (ver deleteClaimAttachment en claim.actions.ts). */
  async delete(tx: Db, attachmentId: string) {
    await tx.delete(claimAttachments).where(eq(claimAttachments.id, attachmentId));
  },
};
