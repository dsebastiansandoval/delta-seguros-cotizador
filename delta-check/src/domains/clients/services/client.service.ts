import type { Db } from "@/db";
import { clientRepository, type NewClient } from "../repositories/client.repository";
import { editableClientUpdates } from "./client-updates";
import { dollarsToCents } from "@/domains/shared/money";
import type { NewAutoQuoteInput, VehicleRiskInput } from "../schemas/client.schema";

/**
 * Orquesta cliente + vehículo(s). Si ya existe un cliente con ese
 * documento (RENOVACIÓN, o el mismo cliente cotizando otro vehículo) no
 * lo duplica — lo reutiliza (ver upsertByDocument) y solo agrega el/los
 * vehículo(s) nuevo(s).
 *
 * `vehicles` puede traer 1 a 4 entradas — Riesgo 1..4 del Excel
 * (EXCEL-AUDIT.md §5, `quote_risks.risk_number`). Se crea un vehículo por
 * cada una, en el mismo orden — `quoteService.createAutoQuote` arma un
 * `quote_risk` por cada vehículo devuelto acá.
 */
export const clientService = {
  /**
   * Cliente por cédula/RUC: si ya existe (renovación, otro vehículo, otro
   * ramo) se reutiliza y se actualiza con lo que el ejecutivo digitó ahora,
   * que es lo que sale en la portada de la cotización.
   */
  async upsertByDocument(tx: Db, data: NewClient) {
    const existing = await clientRepository.findByDocument(tx, data.documentNumber);
    if (!existing) return clientRepository.create(tx, data);

    const updates = editableClientUpdates(data);
    if (!Object.keys(updates).length) return existing;
    await clientRepository.update(tx, existing.id, updates);
    return { ...existing, ...updates };
  },

  async createClientWithVehicles(
    tx: Db,
    organizationId: string,
    agentId: string,
    input: Pick<
      NewAutoQuoteInput,
      | "personType"
      | "documentType"
      | "documentNumber"
      | "firstName"
      | "lastName"
      | "businessName"
      | "birthDate"
      | "maritalStatus"
      | "gender"
      | "email"
      | "phone"
      | "source"
      | "executive"
    > & { vehicles: VehicleRiskInput[] },
  ) {
    const client = await clientService.upsertByDocument(tx, {
      organizationId,
      personType: input.personType,
      documentType: input.documentType,
      documentNumber: input.documentNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      businessName: input.businessName,
      birthDate: input.birthDate,
      maritalStatus: input.maritalStatus,
      gender: input.gender,
      email: input.email || undefined,
      phone: input.phone,
      source: input.source,
      executive: input.executive,
      assignedAgentId: agentId,
    });

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

  /**
   * Corrige cliente + vehículo(s) de una cotización BORRADOR ya creada
   * (ver updateAutoQuote en quote.actions.ts). A diferencia de
   * createClientWithVehicles, acá los vehículos ya existen — se actualizan
   * en el lugar (mismo id), nunca se crean filas nuevas. Si el documento
   * cambió a uno de otro cliente, `upsertByDocument` repunta a ese cliente
   * (o crea uno nuevo) — quien llama es responsable de repuntar
   * `quotes.clientId` al `client.id` devuelto acá.
   */
  async editClientAndVehicles(
    tx: Db,
    organizationId: string,
    input: Pick<
      NewAutoQuoteInput,
      | "personType"
      | "documentType"
      | "documentNumber"
      | "firstName"
      | "lastName"
      | "businessName"
      | "birthDate"
      | "maritalStatus"
      | "gender"
      | "email"
      | "phone"
      | "source"
      | "executive"
    > & { assignedAgentId: string; vehicles: Array<VehicleRiskInput & { vehicleId: string | null }> },
  ) {
    const client = await clientService.upsertByDocument(tx, {
      organizationId,
      personType: input.personType,
      documentType: input.documentType,
      documentNumber: input.documentNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      businessName: input.businessName,
      birthDate: input.birthDate,
      maritalStatus: input.maritalStatus,
      gender: input.gender,
      email: input.email || undefined,
      phone: input.phone,
      source: input.source,
      executive: input.executive,
      assignedAgentId: input.assignedAgentId,
    });

    for (const v of input.vehicles) {
      if (!v.vehicleId) continue;
      await clientRepository.updateVehicle(tx, v.vehicleId, {
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
    }

    return client;
  },
};
