"use client";

import { useActionState } from "react";
import { createFormListItem, moveFormListItem, updateFormListItem } from "@/actions/settings.actions";
import type { ActionResult } from "@/actions/quote.actions";

type Item = { id: string; name: string; isActive: boolean };

const inputClass = "rounded-md border border-border bg-surface px-2 py-1 text-sm";
const moveClass = "rounded px-1.5 text-xs text-muted hover:bg-background disabled:opacity-30";

function Errors({ state }: { state: ActionResult | null }) {
  if (state?.ok !== false) return null;
  return <p className="text-xs text-bad">{Object.values(state.errors).flat()[0]}</p>;
}

function ItemRow({ kind, item, isFirst, isLast }: { kind: string; item: Item; isFirst: boolean; isLast: boolean }) {
  const [state, formAction, pending] = useActionState(updateFormListItem, null);
  return (
    <li className={`flex flex-wrap items-center gap-2 py-1.5 ${item.isActive ? "" : "opacity-60"}`}>
      <form action={moveFormListItem} className="flex flex-col">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={item.id} />
        <button name="direction" value="up" disabled={isFirst} aria-label="Subir" className={moveClass}>
          ▲
        </button>
        <button name="direction" value="down" disabled={isLast} aria-label="Bajar" className={moveClass}>
          ▼
        </button>
      </form>
      <form action={formAction} className="flex flex-1 flex-wrap items-center gap-2">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={item.id} />
        <input name="name" defaultValue={item.name} required aria-label="Nombre" className={`${inputClass} w-56`} />
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" name="isActive" defaultChecked={item.isActive} />
          Activo
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-border px-2 py-0.5 text-xs font-semibold disabled:opacity-60"
        >
          {pending ? "…" : "Guardar"}
        </button>
        {state?.ok === true && <span className="text-xs text-good">Guardado.</span>}
        <Errors state={state} />
      </form>
    </li>
  );
}

/** EJECUTIVO o FUENTE del formulario de cotización: agregar, renombrar, ordenar y desactivar. */
export function FormListEditor({ kind, title, hint, items }: { kind: string; title: string; hint: string; items: Item[] }) {
  const [state, formAction, pending] = useActionState(createFormListItem, null);
  const active = items.filter((i) => i.isActive).length;
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h3 className="text-sm font-semibold">
        {title} <span className="font-normal text-muted">· {active} activos</span>
      </h3>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
      <ul className="mt-3 divide-y divide-border">
        {items.map((item, i) => (
          <ItemRow key={item.id} kind={kind} item={item} isFirst={i === 0} isLast={i === items.length - 1} />
        ))}
      </ul>
      <form action={formAction} key={state?.ok ? "done" : "editing"} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="kind" value={kind} />
        <input name="name" required placeholder="Nuevo nombre" aria-label="Nuevo nombre" className={`${inputClass} w-56`} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-delta-navy px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          {pending ? "…" : "Agregar"}
        </button>
        <Errors state={state} />
      </form>
    </div>
  );
}
