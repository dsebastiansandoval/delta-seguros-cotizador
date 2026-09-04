import { desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { clientRepository } from "../repositories/client.repository";
import { quoteOptions, quoteRisks } from "@/db/schema/quoting";
import { policies } from "@/db/schema/policies";
import { insurers } from "@/db/schema/catalog";

/**
 * "Buscar cotización anterior" — retoma la función de renovación del Excel
 * que había quedado pendiente sin resolver (EXCEL-AUDIT.md §5): el macro
 * `BUSCAR_BASE_VEHICULOS` traía ~48 campos de la tabla `BASE_VEHICULOS` por
 * índice de columna contra una "REFERENCIA" que el ejecutivo escribía a
 * mano. Acá la referencia es la cédula/RUC (mismo campo que ya se usa para
 * el autocompletar del SRI) y el dato sale de las tablas relacionales
 * propias — no hace falta una copia plana de "lo que se cotizó la última
 * vez", eso lo resuelve el propio historial de `quotes`/`policies`.
 *
 * No replica los 13 campos de "aseguradora → prima anterior" que el Excel
 * guardaba por cada riesgo (idx 50-107 de BASE_VEHICULOS) — esa
 * comparación completa ya vive en `quote_options` de la cotización
 * anterior del mismo vehículo, no hace falta copiarla a mano.
 */
export const renewalService = {
  async findPreviousVehicleData(tx: Db, documentNumber: string) {
    const client = await clientRepository.findByDocument(tx, documentNumber);
    if (!client) return null;

    const vehicles = await clientRepository.findVehiclesByClient(tx, client.id);
    if (!vehicles.length) return { client, vehicle: null, previousPolicy: null };

    // El vehículo más reciente del cliente — si tiene varios, éste es el
    // candidato más probable a renovar (mismo criterio que "el último dato
    // gana" del propio Excel, que solo guardaba una fila por referencia).
    const vehicle = [...vehicles].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];

    // vehicle → quote_risks → quote_options → policies — la póliza más
    // reciente emitida para este vehículo específico, si existe.
    const risks = await tx.select().from(quoteRisks).where(eq(quoteRisks.vehicleId, vehicle.id));
    const riskIds = risks.map((r) => r.id);
    const options = riskIds.length
      ? await tx.select().from(quoteOptions).where(inArray(quoteOptions.quoteRiskId, riskIds))
      : [];
    const optionIds = options.map((o) => o.id);

    let previousPolicy = null;
    if (optionIds.length) {
      const [policy] = await tx
        .select({ policy: policies, insurerName: insurers.name })
        .from(policies)
        .innerJoin(insurers, eq(insurers.id, policies.insurerId))
        .where(inArray(policies.quoteOptionId, optionIds))
        .orderBy(desc(policies.createdAt))
        .limit(1);
      previousPolicy = policy ?? null;
    }

    return { client, vehicle, previousPolicy };
  },
};
