import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { insuredGroups, insuredMembers } from "@/db/schema/clients";

export type NewInsuredGroup = typeof insuredGroups.$inferInsert;
export type NewInsuredMember = typeof insuredMembers.$inferInsert;

/** Repositorio puro — igual patrón que clientRepository (ARCHITECTURE.md §2). */
export const insuredGroupRepository = {
  async create(tx: Db, data: NewInsuredGroup) {
    const [group] = await tx.insert(insuredGroups).values(data).returning();
    return group;
  },

  async addMember(tx: Db, data: NewInsuredMember) {
    const [member] = await tx.insert(insuredMembers).values(data).returning();
    return member;
  },

  async findById(tx: Db, groupId: string) {
    const [group] = await tx.select().from(insuredGroups).where(eq(insuredGroups.id, groupId)).limit(1);
    return group ?? null;
  },

  async findTitular(tx: Db, groupId: string) {
    const [member] = await tx
      .select()
      .from(insuredMembers)
      .where(and(eq(insuredMembers.groupId, groupId), eq(insuredMembers.relation, "TITULAR")))
      .limit(1);
    return member ?? null;
  },

  async updateMember(tx: Db, id: string, data: Partial<NewInsuredMember>) {
    await tx.update(insuredMembers).set(data).where(eq(insuredMembers.id, id));
  },

  async findMembers(tx: Db, groupId: string) {
    return tx.select().from(insuredMembers).where(eq(insuredMembers.groupId, groupId));
  },

  async deleteMember(tx: Db, id: string) {
    await tx.delete(insuredMembers).where(eq(insuredMembers.id, id));
  },

  async updateRegion(tx: Db, groupId: string, region: "SIERRA" | "COSTA" | "AUSTRO") {
    await tx.update(insuredGroups).set({ region, updatedAt: new Date() }).where(eq(insuredGroups.id, groupId));
  },
};
