"use client";

import { useSyncExternalStore } from "react";
import { nextTheme, parseThemeValue, type ThemePreference } from "@/domains/shared/theme";

const STORAGE_KEY = "delta-check-theme";
// Evento propio para que el propio botón se entere de un cambio que él
// mismo acaba de escribir — el evento nativo "storage" solo dispara en
// OTRAS pestañas, nunca en la que hizo el cambio.
const CHANGE_EVENT = "delta-check-theme-change";

const LABELS: Record<ThemePreference, string> = {
  system: "Sistema",
  light: "Claro",
  dark: "Oscuro",
};

const ICONS: Record<ThemePreference, string> = {
  system: "🖥️",
  light: "☀️",
  dark: "🌙",
};

function readPreference(): ThemePreference {
  try {
    return parseThemeValue(localStorage.getItem(STORAGE_KEY));
  } catch {
    return "system"; // localStorage puede lanzar en navegación privada/bloqueo de cookies.
  }
}

function getServerSnapshot(): ThemePreference {
  return "system";
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function applyToDocument(pref: ThemePreference) {
  if (pref === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = pref;
}

/**
 * Ciclo Sistema → Claro → Oscuro → Sistema... Los tokens de color ya
 * existían en globals.css (`@media (prefers-color-scheme: dark)` +
 * `:root[data-theme]`) desde antes de este cambio — lo único que faltaba
 * era un control para forzar uno explícito y recordarlo. "Sistema" es el
 * default y no guarda nada en localStorage: quien nunca toca el botón
 * sigue el tema del sistema operativo tal cual, sin quedar congelado en
 * lo que haya sido el tema del SO la primera vez que abrió la página.
 *
 * `useSyncExternalStore` en vez de `useState` + `useEffect`: leer
 * localStorage es sincronizarse con algo externo al render de React —
 * exactamente el caso para el que existe este hook. `getServerSnapshot`
 * devuelve "system", lo mismo que ya asume el HTML que manda el servidor,
 * así que no hay parpadeo de hidratación ni necesidad de esperar a un
 * primer render vacío. El script `beforeInteractive` en layout.tsx ya
 * aplicó el tema guardado antes del primer paint — este hook solo hace
 * que el ícono del botón coincida con lo que ya se aplicó.
 *
 * `variant="floating"` (default) es para páginas sin su propio header
 * (hoy, /login) — flota arriba a la derecha. `variant="inline"` es para
 * meterlo dentro de un header que ya existe (el nav de (dashboard)/layout.tsx),
 * como un botón más de la fila — floating ahí se encimaría con "Cerrar
 * sesión", que vive en esa misma esquina.
 */
export function ThemeToggle({ variant = "floating" }: { variant?: "floating" | "inline" }) {
  const pref = useSyncExternalStore(subscribe, readPreference, getServerSnapshot);

  function cycle() {
    const next = nextTheme(readPreference());
    applyToDocument(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // mismo caso que readPreference() — el tema igual se aplicó en memoria, solo no persiste.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Tema: ${LABELS[pref]} — clic para cambiar`}
      className={
        variant === "floating"
          ? "fixed right-4 top-4 z-50 flex items-center gap-1.5 rounded-full border border-delta-navy-2 bg-delta-navy px-3 py-1.5 text-xs font-medium text-white shadow-md hover:bg-delta-navy-2"
          : "flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-background"
      }
    >
      <span aria-hidden="true">{ICONS[pref]}</span>
      {LABELS[pref]}
    </button>
  );
}
