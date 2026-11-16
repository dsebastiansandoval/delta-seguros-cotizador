/** Autocompletar fecha de nacimiento a partir de la cédula — mismo patrón de puerto/adaptador que `DocumentLookupGateway`/`VehiclePlateLookupGateway`. */
export type BirthDateLookupResult =
  | { status: "FOUND"; birthDate: string }
  | { status: "NOT_FOUND" }
  | { status: "ERROR"; message: string };

export interface BirthDateLookupGateway {
  lookupBirthDate(cedula: string): Promise<BirthDateLookupResult>;
}
