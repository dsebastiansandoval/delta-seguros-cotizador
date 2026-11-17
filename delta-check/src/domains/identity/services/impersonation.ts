import { cookies } from "next/headers";
import crypto from "node:crypto";
import { env } from "@/lib/env";

/**
 * "Ver como este usuario" (pedido de Delta: reproducir en producción lo
 * que ve un agente puntual, sin tener su clave) — una cookie firmada
 * aparte del JWT de next-auth, nunca dentro de él: la sesión real de
 * quien impersona sigue siendo la que decide next-auth; esta cookie solo
 * dice "mientras dure, resolvé los permisos como si fueras este userId" —
 * y solo se respeta si la sesión real ya tiene `user:impersonate`
 * (rbac.service.ts, loadGrants). Firmada con AUTH_SECRET para que no se
 * pueda fabricar a mano desde devtools.
 */
const COOKIE_NAME = "delta_impersonate";
const MAX_AGE_SECONDS = 60 * 60 * 2; // 2h — "salir" también la borra antes

function sign(value: string): string {
  const mac = crypto.createHmac("sha256", env.AUTH_SECRET).update(value).digest("base64url");
  return `${value}.${mac}`;
}

function verify(signed: string): string | null {
  const dot = signed.lastIndexOf(".");
  if (dot < 0) return null;
  const value = signed.slice(0, dot);
  const mac = signed.slice(dot + 1);
  const expected = crypto.createHmac("sha256", env.AUTH_SECRET).update(value).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return value;
}

export async function setImpersonationCookie(targetUserId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, sign(targetUserId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearImpersonationCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getImpersonationTargetUserId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return verify(raw);
}
