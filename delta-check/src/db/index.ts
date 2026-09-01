import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

const pool = new Pool({ connectionString: env.DATABASE_URL });

export const db = drizzle(pool, { schema });

export type Db = typeof db;

/**
 * Toda query que toque una tabla 🏢 (ARCHITECTURE.md §1b) tiene que pasar por
 * acá. `SET LOCAL` solo vive dentro de una transacción, así que envolvemos
 * la operación completa en una — no hay forma de "olvidar" fijar el tenant,
 * porque sin esto la política RLS no deja pasar ninguna fila.
 *
 * Uso: dentro de un servicio de dominio, nunca en un componente.
 *   const clients = await withOrganization(session.organizationId, (tx) =>
 *     tx.select().from(clientsTable)
 *   );
 */
export async function withOrganization<T>(
  organizationId: string,
  run: (tx: Db) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.current_org_id = ${organizationId}`);
    return run(tx as unknown as Db);
  });
}
