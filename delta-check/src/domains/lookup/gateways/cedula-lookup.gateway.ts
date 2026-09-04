/**
 * Autocompletar datos de identidad a partir del documento — mismo patrón de
 * puerto/adaptador que InsurerGateway (§5 de ARCHITECTURE.md): el resto de
 * la app depende de esta interfaz, nunca de la fuente real. Documentado en
 * ARCHITECTURE.md §13 — de las 3 integraciones que se investigaron
 * (SRI para cédula, ANT para placa, PatioTuerca para avalúo), solo esta
 * tiene una fuente pública real sin autenticación; las otras dos no tienen
 * API pública confirmada y quedan sin implementar en vez de construirse
 * sobre un endpoint no documentado sin autorización.
 */
export type PersonLookupResult =
  | { status: "FOUND"; firstName: string; lastName: string; fullName: string }
  | { status: "NOT_FOUND" }
  | { status: "ERROR"; message: string };

export interface CedulaLookupGateway {
  lookupPerson(documentNumber: string): Promise<PersonLookupResult>;
}
