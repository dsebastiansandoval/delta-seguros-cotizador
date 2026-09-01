import type { Db } from "@/db";
import { rateRepository } from "@/domains/catalog/repositories/rate.repository";
import { applyPercent } from "@/domains/shared/money";
import type { InsurerGateway, InsurerQuoteResult, RiskInput } from "./insurer.gateway";

/**
 * Fase 1: solo Latina y Cóndor tienen tabla real hoy (EXCEL-AUDIT.md §2.1).
 * Si el riesgo no matchea ninguna regla de la tabla (o la aseguradora no
 * tiene tabla en absoluto), el resultado es PENDIENTE_MANUAL — no un error:
 * es la misma limitación que ya tienen las otras 11 en el Excel actual.
 */
export class RateTableAdapter implements InsurerGateway {
  readonly mode = "RATE_TABLE" as const;
  constructor(private readonly tx: Db) {}

  async quote(risk: RiskInput): Promise<InsurerQuoteResult> {
    const rule = await rateRepository.findApplicableRule(this.tx, risk);
    if (!rule) return { status: "PENDIENTE_MANUAL" };

    const netPremiumCents = applyPercent(risk.insuredValueCents, Number(rule.ratePercent) * 100);
    return { status: "COTIZADO", netPremiumCents, ratePercentApplied: rule.ratePercent };
  }
}
