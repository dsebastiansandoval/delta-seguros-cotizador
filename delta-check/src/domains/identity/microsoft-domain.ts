/**
 * Filtro de dominio para el login por Microsoft — Delta Check es
 * multi-tenant (ARCHITECTURE.md §1b), así que "cualquier cuenta de
 * Microsoft válida" no alcanza: solo @deltaseguros.com.ec entra por acá.
 * Función pura, separada de auth.ts, para poder testearla sin levantar
 * NextAuth.
 */
export const MICROSOFT_ALLOWED_DOMAIN = "@deltaseguros.com.ec";

export function isAllowedMicrosoftEmail(email: string | null | undefined): boolean {
  return (email ?? "").toLowerCase().endsWith(MICROSOFT_ALLOWED_DOMAIN.toLowerCase());
}
