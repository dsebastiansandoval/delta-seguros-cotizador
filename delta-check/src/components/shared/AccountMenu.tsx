"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { parseThemeValue, type ThemePreference } from "@/domains/shared/theme";
import { initialsFrom } from "@/domains/shared/initials";

const STORAGE_KEY = "cotizador-delta-theme";
const CHANGE_EVENT = "cotizador-delta-theme-change";

const THEME_OPTIONS: ThemePreference[] = ["system", "light", "dark"];

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
    return "system";
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

function applyTheme(pref: ThemePreference) {
  if (pref === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = pref;
  try {
    if (pref === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // localStorage puede lanzar en navegación privada/bloqueo de cookies — el tema igual se aplica en memoria.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Avatar del topbar (mismo lugar/estilo del mockup — círculo navy con 2
 * iniciales, arriba a la derecha) que abre un menú con tema/correo/cerrar
 * sesión — antes vivía como un ícono de engranaje flotante abajo a la
 * derecha; ahora que hay topbar de verdad, este es su lugar natural.
 *
 * `signOutAction` viaja como prop desde el Server Component — un Server
 * Action ("use server") puede pasarse como prop a un Client Component,
 * React/Next lo serializa como referencia; acá se usa igual que si
 * estuviera declarado en este mismo archivo.
 */
export function AccountMenu({
  email,
  fullName,
  signOutAction,
}: {
  email: string;
  fullName: string | null;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pref = useSyncExternalStore(subscribe, readPreference, getServerSnapshot);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={fullName ?? email}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-delta-navy text-xs font-bold text-white hover:bg-delta-navy-2"
      >
        {initialsFrom(fullName, email)}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-60 rounded-xl border border-border bg-surface p-3 text-sm shadow-lg">
          <p className="truncate text-xs font-semibold text-foreground" title={fullName ?? email}>
            {fullName ?? email}
          </p>
          {fullName && (
            <p className="truncate text-xs text-muted" title={email}>
              {email}
            </p>
          )}

          <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Tema</p>
          <div className="flex flex-col gap-0.5">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => applyTheme(option)}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-background ${
                  pref === option ? "bg-background font-semibold text-foreground" : "text-muted"
                }`}
              >
                <span aria-hidden="true">{ICONS[option]}</span>
                {LABELS[option]}
              </button>
            ))}
          </div>

          <form action={signOutAction} className="mt-3 border-t border-border pt-3">
            <button
              type="submit"
              className="w-full rounded-md border border-border px-2 py-1.5 text-left font-medium hover:bg-background"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
