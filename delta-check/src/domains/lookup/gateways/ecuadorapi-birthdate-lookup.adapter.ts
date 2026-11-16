import { env } from "@/lib/env";
import type { BirthDateLookupGateway, BirthDateLookupResult } from "./birthdate-lookup.gateway";

const ECUADOR_API_BASE = "https://api.ecuadorapi.com/api/v1";

type EcuadorApiBirthDateData = { id: string; birth_date: string; age: number };

type EcuadorApiResponse = {
  data: EcuadorApiBirthDateData | null;
  error: boolean | null;
  message: string | null;
};

/**
 * EcuadorAPI fecha de nacimiento (api.ecuadorapi.com, $0.01/consulta,
 * mismo proveedor/API key que `EcuadorApiPlateLookupAdapter` — confirmado
 * en su documentación: `GET /api/v1/cedulas/{cedula}/nacimiento`,
 * respuesta `{ data: { id, birth_date, age }, error, message }`, 404 sin
 * cuerpo útil cuando la cédula no existe).
 */
export class EcuadorApiBirthDateLookupAdapter implements BirthDateLookupGateway {
  async lookupBirthDate(cedula: string): Promise<BirthDateLookupResult> {
    if (!env.ECUADOR_API_KEY) {
      return { status: "ERROR", message: "Fecha de nacimiento no disponible (falta ECUADOR_API_KEY)" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(`${ECUADOR_API_BASE}/cedulas/${cedula}/nacimiento`, {
        headers: { Authorization: `Bearer ${env.ECUADOR_API_KEY}`, Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });

      if (res.status === 404) return { status: "NOT_FOUND" };
      if (!res.ok) return { status: "ERROR", message: `EcuadorAPI respondió ${res.status}` };

      const body: EcuadorApiResponse = await res.json();
      if (!body.data) return { status: "NOT_FOUND" };

      return { status: "FOUND", birthDate: body.data.birth_date };
    } catch (err) {
      const message = err instanceof Error && err.name === "AbortError" ? "EcuadorAPI no respondió a tiempo" : "No se pudo contactar a EcuadorAPI";
      return { status: "ERROR", message };
    } finally {
      clearTimeout(timeout);
    }
  }
}
