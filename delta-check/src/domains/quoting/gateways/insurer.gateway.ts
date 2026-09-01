/**
 * Puerto de aseguradoras — ARCHITECTURE.md §5. En Fase 4 se agregan
 * adaptadores de API reales (AigApiAdapter, etc.) implementando esta misma
 * interfaz; comparison.service no cambia una línea cuando eso pase.
 */
export type RiskInput = {
  insurerId: string;
  bodyType: string;
  vehicleYear: number;
  insuredValueCents: number;
};

export type InsurerQuoteResult =
  | { status: "COTIZADO"; netPremiumCents: number; ratePercentApplied: string }
  | { status: "NO_COTIZA" }
  | { status: "PENDIENTE_MANUAL" }; // el ejecutivo tiene que digitarla — ver RateTableAdapter

export interface InsurerGateway {
  readonly mode: "RATE_TABLE" | "API";
  quote(risk: RiskInput): Promise<InsurerQuoteResult>;
}
