import type { Db } from "@/db";
import { clientRepository } from "../repositories/client.repository";
import { dollarsToCents } from "@/domains/shared/money";
import type { NewClientVehicleInput } from "../schemas/client.schema";

/**
 * Orquesta cliente + vehículo. Si ya existe un cliente con ese documento
 * (RENOVACIÓN, o el mismo cliente cotizando un segundo vehículo) no lo
 * duplica — lo reutiliza y solo agrega el vehículo nuevo.
 */
export const clientService = {
  async createClientWithVehicle(
    tx: Db,
    organizationId: string,
    agentId: string,
    input: NewClientVehicleInput,
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

    const vehicle = await clientRepository.createVehicle(tx, {
      organizationId,
      clientId: client.id,
      plate: input.plate.toUpperCase(),
      brand: input.brand,
      model: input.model,
      year: input.year,
      bodyType: input.bodyType,
      color: input.color,
      commercialValueCents: dollarsToCents(input.commercialValueDollars),
      extrasValueCents: dollarsToCents(input.extrasValueDollars),
      hasTracker: input.hasTracker,
      city: input.city,
      province: input.province,
    });

    return { client, vehicle };
  },
};
