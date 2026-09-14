import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Next.js 16 renombró `middleware.ts`/`middleware` a `proxy.ts`/`proxy` —
 * verificado contra node_modules/next/dist/docs, no asumido de memoria (ver
 * nota en ARCHITECTURE.md §1). Corre siempre en runtime nodejs.
 *
 * Hace tres cosas, ARCHITECTURE.md §8.1/§8.4:
 *  1. Guard de sesión — todo lo que no sea /login o /api/auth requiere estar
 *     autenticado. El chequeo de PERMISO específico (no solo "hay sesión")
 *     vive en cada Server Action vía requirePermission(), no acá — el proxy
 *     es la primera puerta, no la única.
 *  2. Nonce de CSP por request — ver más abajo, corrige un bug real.
 *  3. Headers de seguridad en cada response.
 */
const PUBLIC_PATHS = ["/login", "/api/auth"];

export async function proxy(request: NextRequest) {
  const url = new URL(request.url);
  const isPublic = PUBLIC_PATHS.some((p) => url.pathname.startsWith(p));

  if (!isPublic) {
    const session = await auth();
    if (!session?.user) {
      const loginUrl = new URL("/login", url);
      loginUrl.searchParams.set("from", url.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  /**
   * BUG REAL, encontrado probando la demo en un navegador de verdad (no
   * en esta herramienta de automatización) — reportado por el usuario
   * como "no le doy clic y no pasa nada": el `script-src` de acá abajo
   * decía `'self'` sin `'unsafe-inline'` ni nonce, bajo la premisa (falsa)
   * de que "hoy no hay scripts inline en el proyecto". Next.js SIEMPRE
   * inyecta scripts inline propios — el bootstrap de hidratación
   * (`self.__next_f.push(...)`, el `self.__next_r=...` que arma
   * `self.__next_r`) — sin importar si el código de la app tiene alguno.
   * El navegador los bloqueaba en silencio (CSP no tira error de JS, solo
   * un warning en consola) — React nunca terminaba de hidratar, así que
   * NINGÚN `onClick` de la página funcionaba nunca. Esto es,
   * retroactivamente, la causa real del "problema de hidratación" que se
   * venía documentando en este proyecto como un bug ajeno de la
   * herramienta de automatización del navegador — no lo era: era este
   * bug, reproducible en cualquier navegador, incluido uno real.
   *
   * Fix oficial de Next.js (node_modules/next/dist/docs/.../
   * content-security-policy.md): un nonce nuevo por request, agregado al
   * `script-src` con `'strict-dynamic'`, y pasado también como header de
   * REQUEST (`x-nonce`) para que un Server Component lo lea con
   * `headers()` y se lo pase a cualquier `<Script>` — ver layout.tsx.
   * `'unsafe-eval'` solo en desarrollo: React usa `eval` ahí para
   * reconstruir stack traces del servidor en el navegador (el propio doc
   * de Next.js lo aclara), nunca en producción.
   */
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.google.com/recaptcha/${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' data: https:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // ARCHITECTURE.md §8.1 — CSP estricta, HSTS, y el resto de headers.
  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
