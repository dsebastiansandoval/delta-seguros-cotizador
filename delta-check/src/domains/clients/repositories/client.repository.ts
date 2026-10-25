import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { clients, vehicles } from "@/db/schema/clients";

export type NewClient = typeof clients.$inferInsert;
export type NewVehicle = typeof vehicles.$inferInsert;

/**
 * Repositorio — acceso a datos puro, sin reglas de negocio (ARCHITECTURE.md
 * §2 Clean Architecture). Recibe `tx` porque siempre corre dentro de
 * withOrganization(); nunca abre su propia conexión.
 */
export const clientRepository = {
  async findByDocument(tx: Db, documentNumber: string) {
    const [client] = await tx
      .select()
      .from(clients)
      .where(eq(clients.documentNumber, documentNumber))
      .limit(1);
    return client ?? null;
  },

  async create(tx: Db, data: NewClient) {
    const [client] = await tx.insert(clients).values(data).returning();
    return client;
  },

  async update(tx: Db, id: string, data: Partial<NewClient>) {
    await tx.update(clients).set({ ...data, updatedAt: new Date() }).where(eq(clients.id, id));
  },

  async createVehicle(tx: Db, data: NewVehicle) {
    const [vehicle] = await tx.insert(vehicles).values(data).returning();
    return vehicle;
  },

  async findVehiclesByClient(tx: Db, clientId: string) {
    return tx.select().from(vehicles).where(eq(vehicles.clientId, clientId));
  },
};
