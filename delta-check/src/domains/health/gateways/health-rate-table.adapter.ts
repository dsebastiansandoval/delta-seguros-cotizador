import type { Db } from "@/db";
import { healthRateRepository } from "../repositories/health-rate.repository";
import type {
  HealthInsurerGateway,
  HealthMemberInput,
  HealthQuoteResult,
} from "./health-insurer.gateway";

/**
 * Fase 2 completa: las 7 aseguradoras de Salud con motor de tarifas real en
 * el Excel (BMI, Humana, Confiamed, SaludSA, Pro, VB y Salud genérica)
 * tienen tabla sembrada (EXCEL-AUDIT.md §2.3). Solo Bupa queda en
 * PENDIENTE_MANUAL — su hoja no tiene una sola fórmula VLOOKUP, confirmado
 * que no hay tabla en absoluto. Ninguna cifra se inventa para lo que falta.
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
