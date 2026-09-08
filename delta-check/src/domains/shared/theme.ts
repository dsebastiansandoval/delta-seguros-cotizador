export type ThemePreference = "system" | "light" | "dark";

/**
 * Lo que haya en localStorage puede ser cualquier basura vieja (otra
 * versión de la app, un valor manipulado a mano) — cualquier cosa que no
 * sea exactamente "light"/"dark" cae a "system", nunca se lanza un error
 * por un valor inesperado.
 */
export function parseThemeValue(raw: string | null): ThemePreference {
  return raw === "light" || raw === "dark" ? raw : "system";
}

const CYCLE: ThemePreference[] = ["system", "light", "dark"];

/** Sistema → Claro → Oscuro → Sistema... — ver ThemeToggle.tsx. */
export function nextTheme(current: ThemePreference): ThemePreference {
  return CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
}
