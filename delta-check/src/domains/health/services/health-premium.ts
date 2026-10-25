import { HEALTH_PLANS } from "../health-plans.generated";

/**
 * OFERTA AM filas 63-67: prima neta + OTROS CARGOS (fijo por plan, fila 64)
 * = subtotal; el 0.5% de Seguro Campesino se cobra sobre el subtotal.
 */
export function otrosCargosCents(insurerCode: string, planCode: string | null): number {
  return HEALTH_PLANS.find((p) => p.insurerCode === insurerCode && p.planCode === planCode)?.otrosCargosCents ?? 0;
}

export function healthPremium(netPremiumCents: number, otrosCents: number) {
  const subtotalCents = netPremiumCents + otrosCents;
  const campesinoCents = Math.round(subtotalCents * 0.005);
  return { netPremiumCents, emissionFeeCents: otrosCents, campesinoCents, totalPremiumCents: subtotalCents + campesinoCents };
}
