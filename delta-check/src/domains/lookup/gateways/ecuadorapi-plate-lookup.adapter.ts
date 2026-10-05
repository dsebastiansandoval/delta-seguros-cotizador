import { env } from "@/lib/env";
import type { VehiclePlateLookupGateway, VehiclePlateLookupResult } from "./vehicle-plate-lookup.gateway";

const ECUADOR_API_BASE = "https://api.ecuadorapi.com/api/v1";

type EcuadorApiPlateData = {
  plate: string;
  brand: string;
  model: string;
  year: number;
  color: string | null;
  vehicle_class: string | null;
};

type EcuadorApiResponse = {
  data: EcuadorApiPlateData | null;
  error: boolean | null;
  message: string | null;
};

/**
 * EcuadorAPI (api.ecuadorapi.com, $0.02/consulta según su documentación) —
 * placa no tenía fuente pública confirmada antes (ARCHITECTURE.md §13
 * descartó ANT por falta de API pública), esta es de pago con API key
 * propia. Endpoint real confirmado: `GET /api/v1/placas/{placa}`.
 *
 * `vehicle_class` de la API (ej. "AUTOMOVIL") no mapea 1:1 a `LIVIANO`/
 * `PICKUP` del sistema — se infiere por palabra clave, es una sugerencia
 * que el agente puede corregir, no un hecho verificado (mismo criterio que
 * `provinceFromCedula`).
 */
function inferBodyType(vehicleClass: string | null): "LIVIANO" | "PICKUP" {
  if (vehicleClass && /CAMIONETA|PICKUP/i.test(vehicleClass)) return "PICKUP";
  return "LIVIANO";
}

/** Placas ecuatorianas: 3 letras + 3-4 dígitos. Formato laxo a propósito — mejor dejar pasar un caso raro que bloquear uno válido. */
function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase().replace(/[\s-]/g, "");
}

function isValidPlateFormat(plate: string): boolean {
  return /^[A-Z]{2,3}\d{3,4}$/.test(plate);
}

export class EcuadorApiPlateLookupAdapter implements VehiclePlateLookupGateway {
  async lookupPlate(plateInput: string): Promise<VehiclePlateLookupResult> {
    const plate = normalizePlate(plateInput);
    if (!isValidPlateFormat(plate)) {
      return { status: "ERROR", message: "Formato de placa no reconocido" };
    }
    if (!env.ECUADOR_API_KEY) {
      return { status: "ERROR", message: "Búsqueda por placa no configurada (falta ECUADOR_API_KEY)" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(`${ECUADOR_API_BASE}/placas/${plate}`, {
        headers: { Authorization: `Bearer ${env.ECUADOR_API_KEY}`, Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });

      if (res.status === 404) return { status: "NOT_FOUND" };
      if (!res.ok) return { status: "ERROR", message: `EcuadorAPI respondió ${res.status}` };

      const body: EcuadorApiResponse = await res.json();
      if (!body.data) return { status: "NOT_FOUND" };

      return {
        status: "FOUND",
        brand: body.data.brand,
        model: body.data.model,
        year: body.data.year,
        color: body.data.color,
        bodyType: inferBodyType(body.data.vehicle_class),
      };
    } catch (err) {
      const message = err instanceof Error && err.name === "AbortError" ? "EcuadorAPI no respondió a tiempo" : "No se pudo contactar a EcuadorAPI";
      return { status: "ERROR", message };
    } finally {
      clearTimeout(timeout);
    }
  }
}
