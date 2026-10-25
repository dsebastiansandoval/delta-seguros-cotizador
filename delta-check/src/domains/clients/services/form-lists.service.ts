import { and, asc, eq, max, ne, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { quoteExecutives, quoteSources } from "@/db/schema/clients";

/** Las dos listas cerradas del formulario de cotización (INFO GENERAL del Excel). */
export const FORM_LISTS = {
  executives: { table: quoteExecutives, label: "Ejecutivos", field: "EJECUTIVO" },
  sources: { table: quoteSources, label: "Fuentes", field: "FUENTE" },
} as const;
export type FormListKind = keyof typeof FORM_LISTS;

/** Nombre repetido u otra regla violada — el mensaje se muestra tal cual. */
export class FormListError extends Error {}

/**
 * ABM de EJECUTIVO y FUENTE desde /admin/configuracion. Nunca se borra un
 * nombre: `clients.executive`/`source` lo guardan como texto, así que
 * desactivarlo solo lo saca del selector. El Excel guarda los nombres en
 * mayúsculas y así se comparan.
 */
export const formListsService = {
  async list(tx: Db, kind: FormListKind) {
    const { table } = FORM_LISTS[kind];
    return tx
      .select({ id: table.id, name: table.name, isActive: table.isActive, displayOrder: table.displayOrder })
      .from(table)
      .orderBy(asc(table.displayOrder), asc(table.name));
  },

  async create(tx: Db, organizationId: string, kind: FormListKind, name: string) {
    const { table } = FORM_LISTS[kind];
    await assertUniqueName(tx, kind, name);
    const [{ last } = { last: null }] = await tx.select({ last: max(table.displayOrder) }).from(table);
    const [row] = await tx
      .insert(table)
      .values({ organizationId, name, displayOrder: (last ?? -1) + 1 })
      .returning();
    return row;
  },

  async update(tx: Db, kind: FormListKind, input: { id: string; name: string; isActive: boolean }) {
    const { table } = FORM_LISTS[kind];
    await assertUniqueName(tx, kind, input.name, input.id);
    const updated = await tx
      .update(table)
      .set({ name: input.name, isActive: input.isActive })
      .where(eq(table.id, input.id))
      .returning({ id: table.id });
    if (!updated.length) throw new FormListError("No se encontró el nombre");
  },

  /** Intercambia el orden con el vecino de arriba o de abajo. */
  async move(tx: Db, kind: FormListKind, id: string, direction: "up" | "down") {
    const rows = await formListsService.list(tx, kind);
    const index = rows.findIndex((r) => r.id === id);
    const neighborIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || !rows[neighborIndex]) return;
    const { table } = FORM_LISTS[kind];
    // Se renumera todo para no depender de que los displayOrder vengan sin repetir.
    const reordered = [...rows];
    reordered[index] = rows[neighborIndex];
    reordered[neighborIndex] = rows[index];
    for (const [order, row] of reordered.entries()) {
      if (row.displayOrder !== order) await tx.update(table).set({ displayOrder: order }).where(eq(table.id, row.id));
    }
  },
};

async function assertUniqueName(tx: Db, kind: FormListKind, name: string, exceptId?: string) {
  const { table, label } = FORM_LISTS[kind];
  const [clash] = await tx
    .select({ id: table.id })
    .from(table)
    .where(and(sql`upper(${table.name}) = upper(${name})`, exceptId ? ne(table.id, exceptId) : undefined));
  if (clash) throw new FormListError(`"${name}" ya está en ${label}`);
}
