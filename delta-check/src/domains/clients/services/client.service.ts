import type { Db } from "@/db";
import { clientRepository } from "../repositories/client.repository";
import { dollarsToCents } from "@/domains/shared/money";
import type { NewAutoQuoteInput, VehicleRiskInput } from "../schemas/client.schema";

/**
 * Orquesta cliente + vehículo(s). Si ya existe un cliente con ese
 * documento (RENOVACIÓN, o el mismo cliente cotizando otro vehículo) no
 * lo duplica — lo reutiliza y solo agrega el/los vehículo(s) nuevo(s).
 *
 * `vehicles` puede traer 1 a 4 entradas — Riesgo 1..4 del Excel
 * (EXCEL-AUDIT.md §5, `quote_risks.risk_number`). Se crea un vehículo por
 * cada una, en el mismo orden — `quoteService.createAutoQuote` arma un
 * `quote_risk` por cada vehículo devuelto acá.
 */
export const clientService = {
  async createClientWithVehicles(
    tx: Db,
    organizationId: string,
    agentId: string,
    input: Pick<
      NewAutoQuoteInput,
      "personType" | "documentType" | "documentNumber" | "firstName" | "lastName" | "businessName" | "email" | "phone" | "source"
    > & { vehicles: VehicleRiskInput[] },
  ) {
    const existing = await clientRepository.findByDocument(tx, input.documentNumber);

    const client =
      existing ??
      (await clientRepository.create(tx, {
        organizationId,
        personType: input.personType,
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        businessName: input.businessName,
        email: input.email || undefined,
        phone: input.phone,
        source: input.source,
        assignedAgentId: agentId,
      }));

    const vehicles = [];
    for (const v of input.vehicles) {
      const vehicle = await clientRepository.createVehicle(tx, {
        organizationId,
        clientId: client.id,
        plate: v.plate.toUpperCase(),
        brand: v.brand,
        model: v.model,
        year: v.year,
        bodyType: v.bodyType,
        color: v.color,
        commercialValueCents: dollarsToCents(v.commercialValueDollars),
        extrasValueCents: dollarsToCents(v.extrasValueDollars),
        hasTracker: v.hasTracker,
        city: v.city,
        province: v.province,
      });
      vehicles.push(vehicle);
    }

    return { client, vehicles };
  },
};
