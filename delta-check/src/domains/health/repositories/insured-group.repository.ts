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
};
