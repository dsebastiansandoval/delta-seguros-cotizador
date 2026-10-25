/**
 * Puerto de aseguradoras de Salud — mismo patrón que
 * los adaptadores de Autos, pero con la forma de riesgo
 * que le corresponde a Salud (edad/sexo/región, no valor asegurado). Ver
 * ARCHITECTURE.md §5.
 */
export type HealthMemberInput = {
  insurerId: string;
  age: number;
  gender: "MASCULINO" | "FEMENINO";
  region: "SIERRA" | "COSTA" | "AUSTRO";
  relation: "TITULAR" | "DEPENDIENTE";
};

export type HealthPlanQuote = {
  planCode: string;
  deductibleCode: string | null;
  premiumCents: number;
};

export type HealthQuoteResult =
  | { status: "COTIZADO"; plans: HealthPlanQuote[] }
  | { status: "PENDIENTE_MANUAL" };

export interface HealthInsurerGateway {
  quoteMember(member: HealthMemberInput): Promise<HealthQuoteResult>;
}
