import { randomBytes, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import type { Db } from "@/db";
import { users } from "@/db/schema/identity";

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h — mismo plazo para "crear clave" (invitación) y "recuperar clave"

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Emite un token de "crear/recuperar clave" — el valor real (`rawToken`,
 * el que va en el link del correo) nunca se persiste; solo su hash SHA-256.
 * Pisa cualquier token anterior del usuario (uno solo válido a la vez).
 */
export async function issuePasswordResetToken(tx: Db, userId: string): Promise<string> {
  const rawToken = randomBytes(32).toString("base64url");
  await tx
    .update(users)
    .set({
      passwordResetTokenHash: hashToken(rawToken),
      passwordResetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    })
    .where(eq(users.id, userId));
  return rawToken;
}

/** Valida el token del link (existe, no venció) y devuelve el usuario — null si no sirve. */
export async function findUserByResetToken(tx: Db, rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const [user] = await tx.select().from(users).where(eq(users.passwordResetTokenHash, tokenHash)).limit(1);
  if (!user || !user.passwordResetTokenExpiresAt || user.passwordResetTokenExpiresAt < new Date()) return null;
  return user;
}

/** Fija la clave nueva y consume el token (no se puede reusar). */
export async function setPasswordAndConsumeToken(tx: Db, userId: string, newPassword: string): Promise<void> {
  await tx
    .update(users)
    .set({
      passwordHash: await hashPassword(newPassword),
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
