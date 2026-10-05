/**
 * Autocompletar datos de identidad a partir del documento — mismo patrón de
 * puerto/adaptador que InsurerGateway (§5 de ARCHITECTURE.md): el resto de
 * la app depende de esta interfaz, nunca de la fuente real. Documentado en
 * ARCHITECTURE.md §13 — de las 3 integraciones que se investigaron
 * (SRI para cédula, ANT para placa, PatioTuerca para avalúo), solo esta
 * tiene una fuente pública real sin autenticación; las otras dos no tienen
 * API pública confirmada y quedan sin implementar en vez de construirse
 * sobre un endpoint no documentado sin autorización.
 *
 * `kind` distingue persona natural (cédula, o RUC de persona natural) de
 * sociedad (RUC de empresa) — una cédula nunca es `JURIDICA`, pero un RUC
 * sí puede ser cualquiera de los dos según su tercer dígito.
 */
export type DocumentLookupResult =
  | { status: "FOUND"; kind: "NATURAL"; firstName: string; lastName: string; fullName: string; province: string | null }
  | { status: "FOUND"; kind: "JURIDICA"; businessName: string }
  | { status: "NOT_FOUND" }
  | { status: "ERROR"; message: string };

export interface DocumentLookupGateway {
  lookupByCedula(cedula: string): Promise<DocumentLookupResult>;
  lookupByRuc(ruc: string): Promise<DocumentLookupResult>;
}
