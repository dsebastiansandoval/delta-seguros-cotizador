/**
 * Autocompletar datos de vehículo a partir de la placa — mismo patrón de
 * puerto/adaptador que `DocumentLookupGateway`. A diferencia de cédula/RUC
 * (SRI, gratis), esto no tenía fuente pública confirmada (ARCHITECTURE.md
 * §13 descartó ANT por falta de API pública) hasta que el usuario consiguió
 * acceso a EcuadorAPI — ver `EcuadorApiPlateLookupAdapter`.
 */
export type VehiclePlateLookupResult =
  | { status: "FOUND"; brand: string; model: string; year: number; color: string | null; bodyType: "LIVIANO" | "PICKUP" }
  | { status: "NOT_FOUND" }
  | { status: "ERROR"; message: string };

export interface VehiclePlateLookupGateway {
  lookupPlate(plate: string): Promise<VehiclePlateLookupResult>;
}
