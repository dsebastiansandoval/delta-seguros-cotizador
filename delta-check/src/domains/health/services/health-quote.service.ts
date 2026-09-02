import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { quoteRisks, quotes } from "@/db/schema/quoting";
import { insuredGroupRepository } from "../repositories/insured-group.repository";

function generateQuoteCode(): string {
  const year = new Date().getFullYear();
  const suffix = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");
  return `COT-${year}-${suffix}`;
}

export type NewMemberInput = { relation: "TITULAR" | "DEPENDIENTE"; age: number; gender: "MASCULINO" | "FEMENINO" };

export const healthQuoteService = {
  async createHealthQuote(
    tx: Db,
    params: {
      organizationId: string;
      agentId: string;
      clientId: string;
      region: "SIERRA" | "COSTA" | "AUSTRO";
      members: NewMemberInput[];
      operationType: "NUEVA" | "RENOVACION";
    },
  ) {
    const [quote] = await tx
      .insert(quotes)
      .values({
        organizationId: params.organizationId,
        code: generateQuoteCode(),
        clientId: params.clientId,
        agentId: params.agentId,
        branch: "SALUD",
        operationType: params.operationType,
        status: "BORRADOR",
      })
      .returning();

    const group = await insuredGroupRepository.create(tx, {
      organizationId: params.organizationId,
      clientId: params.clientId,
      region: params.region,
    });

    for (const member of params.members) {
      await insuredGroupRepository.addMember(tx, {
        organizationId: params.organizationId,
        groupId: group.id,
        relation: member.relation,
        age: member.age,
        gender: member.gender,
      });
    }

    const [risk] = await tx
      .insert(quoteRisks)
      .values({
        organizationId: params.organizationId,
        quoteId: quote.id,
        riskNumber: 1,
        insuredGroupId: group.id,
      })
      .returning();

    return { quote, risk, group };
  },

  async findById(tx: Db, quoteId: string) {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
    return quote ?? null;
  },
};
