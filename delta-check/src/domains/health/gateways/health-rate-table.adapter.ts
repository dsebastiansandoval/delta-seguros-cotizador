import type { Db } from "@/db";
import { healthRateRepository } from "../repositories/health-rate.repository";
import type {
  HealthInsurerGateway,
  HealthMemberInput,
  HealthQuoteResult,
} from "./health-insurer.gateway";

/**
 * Fase 2 v1: BMI (Sigma) y Humana tienen tabla real sembrada
 * (EXCEL-AUDIT.md §2.3). El resto (Confiamed, SaludSA, Pro, VB) tiene el
 * rango de `BASES ASEGURADORAS AM` ya confirmado por fórmula pero sin
 * sembrar todavía — quedan en PENDIENTE_MANUAL, igual que Bupa (sin tabla
 * en absoluto). Ninguna cifra se inventa para las que faltan.
 */
export class HealthRateTableAdapter implements HealthInsurerGateway {
  constructor(private readonly tx: Db) {}

  async quoteMember(member: HealthMemberInput): Promise<HealthQuoteResult> {
    const rules = await healthRateRepository.findApplicableRules(this.tx, member);
    if (!rules.length) return { status: "PENDIENTE_MANUAL" };

    return {
      status: "COTIZADO",
      plans: rules.map((r) => ({
        planCode: r.planCode,
        deductibleCode: r.deductibleCode,
        premiumCents: r.premiumCents,
      })),
    };
  }
}
