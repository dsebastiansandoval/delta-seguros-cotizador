import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Next.js 16 renombró `middleware.ts`/`middleware` a `proxy.ts`/`proxy` —
 * verificado contra node_modules/next/dist/docs, no asumido de memoria (ver
 * nota en ARCHITECTURE.md §1). Corre siempre en runtime nodejs.
 *
 * Hace dos cosas, ARCHITECTURE.md §8.1/§8.4:
 *  1. Guard de sesión — todo lo que no sea /login o /api/auth requiere estar
 *     autenticado. El chequeo de PERMISO específico (no solo "hay sesión")
 *     vive en cada Server Action vía requirePermission(), no acá — el proxy
 *     es la primera puerta, no la única.
 *  2. Headers de seguridad en cada response.
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

  const response = NextResponse.next();

  // ARCHITECTURE.md §8.1 — CSP estricta, HSTS, y el resto de headers.
  // El nonce de CSP para scripts inline se agrega cuando exista un caso real
  // que lo necesite (hoy no hay scripts inline en el proyecto).
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' https://www.google.com/recaptcha/",
      "style-src 'self'",
      "img-src 'self' data: https:",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; "),
  );
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
