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
};
