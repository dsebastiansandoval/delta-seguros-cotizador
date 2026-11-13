import type { AuthorizedSession } from "./rbac.service";

/**
 * Lógica pura de "Ejecutivo"/"Vendedor" — separada de rbac.service.ts a
 * propósito: ese archivo importa `@/lib/auth` (NextAuth completo) a nivel
 * de módulo, lo que rompe bajo Vitest incluso para probar una función pura
 * (`Cannot find module 'next/server'` — next-auth no resuelve fuera del
 * bundler de Next). Acá no se importa nada de auth/DB, así que se puede
 * testear directo (ver vendor-assignment.test.ts).
 */

/**
 * El campo "Ejecutivo" de una cotización (Autos/Salud) ya no es asignable
 * por nadie — es puramente de auditoría (quién cargó la cotización),
 * oculto en el formulario. Antes de VENDEDOR, este era el campo que
 * reflejaba "quién gestionó la venta"; ese rol lo tiene ahora `resolveVendor`.
 */
export function resolveExecutive(session: Pick<AuthorizedSession, "fullName">): string | undefined {
  return session.fullName ?? undefined;
}

/**
 * Modo del campo "Vendedor" en el formulario de cotización — tres niveles,
 * a pedido explícito de Delta (reunión del 12 de noviembre):
 *  - "free": ADMIN/SUPERVISOR (`quote:assign_vendor`) — texto libre con
 *    lista de sugerencias, puede escribir un nombre que no esté en la lista.
 *  - "select": Agente (`quote:select_vendor`) — lista cerrada completa,
 *    no puede escribir uno nuevo.
 *  - "locked": Freelance (ninguno de los dos permisos) — fijo a su propio
 *    nombre, igual que "Ejecutivo" se le fijaba antes.
 */
export function vendorMode(session: Pick<AuthorizedSession, "permissions">): "free" | "select" | "locked" {
  if (session.permissions.has("quote:assign_vendor")) return "free";
  if (session.permissions.has("quote:select_vendor")) return "select";
  return "locked";
}

/**
 * Resuelve el "Vendedor" final de una cotización según `vendorMode` —
 * nunca se confía en que el cliente deshabilitó/transformó el campo:
 *  - "free": lo que mandó el formulario (o el propio nombre si vino vacío).
 *  - "select": solo si coincide con `validVendors` (la misma lista cerrada
 *    que se le mostró) — si alguien arma el POST a mano con otro nombre,
 *    se ignora y queda el propio.
 *  - "locked": siempre el propio nombre, ignora lo que haya mandado el forms.
 */
export function resolveVendor(
  session: Pick<AuthorizedSession, "permissions" | "fullName">,
  submitted: string | undefined,
  validVendors: string[],
): string | undefined {
  const mode = vendorMode(session);
  if (mode === "free") return submitted || (session.fullName ?? undefined);
  if (mode === "select" && submitted && validVendors.includes(submitted)) return submitted;
  return session.fullName ?? undefined;
}
