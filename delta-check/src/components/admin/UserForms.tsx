"use client";

import { useActionState } from "react";
import { createUser, updateUser } from "@/actions/user.actions";
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
    </li>
  );
}
