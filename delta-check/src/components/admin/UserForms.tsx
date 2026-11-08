"use client";

import { useActionState, useState, useTransition } from "react";
import { createUser, generateInviteLink, sendInviteEmail, updateUser } from "@/actions/user.actions";
import type { ActionResult } from "@/actions/quote.actions";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/domains/identity/schemas/user.schema";

const BRANCHES = [
  { value: "AUTOS", label: "Autos" },
  { value: "SALUD", label: "Salud AM" },
] as const;

const inputClass = "rounded-md border border-border bg-surface px-2 py-1 text-sm";

function Errors({ state }: { state: ActionResult | null }) {
  if (state?.ok !== false) return null;
  const messages = Object.values(state.errors).flat();
  return <p className="text-xs text-bad">{messages[0]}</p>;
}

function RoleSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <select name="role" defaultValue={defaultValue ?? "AGENTE"} aria-label="Rol" className={inputClass}>
      {ASSIGNABLE_ROLES.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABELS[role]}
        </option>
      ))}
    </select>
  );
}

function BranchChecks({ selected }: { selected: string[] }) {
  return (
    <div className="flex items-center gap-3">
      {BRANCHES.map((b) => (
        <label key={b.value} className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="branches" value={b.value} defaultChecked={selected.includes(b.value)} />
          {b.label}
        </label>
      ))}
    </div>
  );
}

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUser, null);
  return (
    // key: se vacía el formulario después de crear la cuenta.
    <form action={formAction} key={state?.ok ? "done" : "editing"} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Correo
        <input name="email" type="email" required placeholder="nombre@deltaseguros.com.ec" className={`${inputClass} w-64`} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Nombre
        <input name="fullName" required className={`${inputClass} w-52`} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Rol
        <RoleSelect />
      </label>
      <div className="flex flex-col gap-1 text-xs text-muted">
        Ramos
        <BranchChecks selected={["AUTOS", "SALUD"]} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-delta-navy px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending ? "…" : "Crear usuario"}
      </button>
      {state?.ok === true && <span className="text-sm font-semibold text-good">Usuario creado.</span>}
      <Errors state={state} />
    </form>
  );
}

/** "Generar link" — token de crear/recuperar clave para copiar y pasarle a mano al usuario, sin esperar el correo. */
function GenerateLinkButton({ userId }: { userId: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick(openInNewTab = false) {
    startTransition(async () => {
      const result = await generateInviteLink(userId);
      if (result.ok) {
        setLink(result.value);
        setError(null);
        // "Cambiar clave": un clic, directo a la página de crear/recuperar clave —
        // sin el paso intermedio de copiar y pegar el link a mano.
        if (openInNewTab) window.open(result.value, "_blank", "noopener,noreferrer");
      } else {
        setLink(null);
        setError(Object.values(result.errors).flat()[0] ?? "No se pudo generar el link");
      }
    });
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard API puede fallar sin permiso del navegador — el input queda igual seleccionable a mano.
    }
  }

  const [emailStatus, setEmailStatus] = useState<"sent" | "logged" | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailPending, startEmailTransition] = useTransition();

  function handleSendEmail() {
    startEmailTransition(async () => {
      const result = await sendInviteEmail(userId);
      if (result.ok) {
        setEmailStatus(result.value.sent ? "sent" : "logged");
        setEmailError(null);
      } else {
        setEmailStatus(null);
        setEmailError(Object.values(result.errors).flat()[0] ?? "No se pudo enviar el correo");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => handleClick(false)}
        disabled={pending}
        className="rounded-md border border-border px-3 py-1 text-xs font-semibold disabled:opacity-60"
      >
        {pending ? "…" : "Generar link"}
      </button>
      <button
        type="button"
        onClick={() => handleClick(true)}
        disabled={pending}
        className="rounded-md border border-border px-3 py-1 text-xs font-semibold disabled:opacity-60"
      >
        {pending ? "…" : "Cambiar clave"}
      </button>
      {link && (
        <>
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Link para crear clave"
            className={`${inputClass} w-64`}
          />
          <button type="button" onClick={copyLink} className="text-xs font-semibold text-link underline">
            Copiar
          </button>
        </>
      )}
      <button
        type="button"
        onClick={handleSendEmail}
        disabled={emailPending}
        className="rounded-md border border-border px-3 py-1 text-xs font-semibold disabled:opacity-60"
      >
        {emailPending ? "…" : "Enviar correo"}
      </button>
      {emailStatus === "sent" && <span className="text-xs font-semibold text-good">Correo enviado.</span>}
      {emailStatus === "logged" && (
        <span className="text-xs text-warn">
          No se pudo mandar el correo (falta RESEND_API_KEY o el dominio) — usa &quot;Generar link&quot;.
        </span>
      )}
      {error && <span className="text-xs text-bad">{error}</span>}
      {emailError && <span className="text-xs text-bad">{emailError}</span>}
    </div>
  );
}

export type UserRowData = {
  id: string;
  email: string;
  fullName: string;
  role: string | null;
  branches: string[];
  isActive: boolean;
  lastLoginAt: Date | null;
};

export function UserRow({ user, isSelf }: { user: UserRowData; isSelf: boolean }) {
  const [state, formAction, pending] = useActionState(updateUser, null);
  return (
    <li className={`px-5 py-3 ${user.isActive ? "" : "opacity-60"}`}>
      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="userId" value={user.id} />
        <div className="flex w-64 flex-col">
          <input name="fullName" defaultValue={user.fullName} required aria-label="Nombre" className={inputClass} />
          <span className="mt-0.5 truncate text-xs text-muted">
            {user.email}
            {isSelf && " · tú"}
          </span>
        </div>
        <RoleSelect defaultValue={user.role ?? undefined} />
        <BranchChecks selected={user.branches} />
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={user.isActive} />
          Activo
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-border px-3 py-1 text-xs font-semibold disabled:opacity-60"
        >
          {pending ? "…" : "Guardar"}
        </button>
        {state?.ok === true && <span className="text-xs font-semibold text-good">Guardado.</span>}
        <Errors state={state} />
        <span className="ml-auto text-xs text-muted">
          {user.lastLoginAt ? `Último ingreso ${user.lastLoginAt.toLocaleDateString("es-EC")}` : "Nunca ingresó"}
        </span>
      </form>
      <div className="mt-2 border-t border-border pt-2">
        <GenerateLinkButton userId={user.id} />
      </div>
    </li>
  );
}
