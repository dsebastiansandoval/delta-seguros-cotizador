export const CLAIM_STATUSES = ["REPORTADO", "APROBADO", "REPARADO", "ENTREGADO"] as const;

/**
 * Etiquetas visibles del estado de un siniestro — iguales al código interno
 * salvo APROBADO/REPARADO, renombradas a pedido del usuario para que
 * coincidan con el vocabulario real de Delta ("Autorizado", "En
 * reparación"). El código del enum (`claim_status` en la base,
 * `claimStatusEnum`) no cambia, solo el texto que ve el agente — sin
 * migración, sin tocar datos existentes.
 */
// `Record<string, string>` (no solo las 4 claves del enum) a propósito —
// el historial de un siniestro (`claimEvents.fromStatus`) llega tipado como
// `string | null` desde la base, y se indexa con eso tal cual.
export const CLAIM_STATUS_LABEL: Record<string, string> = {
  REPORTADO: "Reportado",
  APROBADO: "Autorizado",
  REPARADO: "En reparación",
  ENTREGADO: "Entregado",
};
