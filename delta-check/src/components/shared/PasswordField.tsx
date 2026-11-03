"use client";

import { useState } from "react";

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
      <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M7.4 7.5C4.9 8.9 3 12 3 12s3.5 7 9.5 7c1.8 0 3.3-.4 4.6-1.1M16.8 16.8C19.3 15.4 21 12 21 12s-1.4-2.8-4-4.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Input de clave con botón de "ojo" para alternar texto plano — mismo <input name> de siempre, solo cambia `type`. */
export function PasswordField({
  id,
  name,
  label,
  minLength,
  required = true,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  minLength?: number;
  required?: boolean;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="text-xs font-semibold text-muted" htmlFor={id}>
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          minLength={minLength}
          required={required}
          autoComplete={autoComplete}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 pr-10 text-sm"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar clave" : "Mostrar clave"}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-foreground"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}
