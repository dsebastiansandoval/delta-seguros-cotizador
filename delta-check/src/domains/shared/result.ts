/**
 * Result<T, E> — para flujo de negocio esperado (ej. "esta aseguradora no
 * cotiza"), nunca para bugs. Un bug lanza una excepción de verdad; un
 * resultado de negocio que puede no-ser-éxito usa esto. Ver ARCHITECTURE.md
 * §3 (src/domains/shared/result.ts en el árbol de carpetas).
 */
export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
