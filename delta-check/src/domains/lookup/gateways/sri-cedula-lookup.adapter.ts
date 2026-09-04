import type { CedulaLookupGateway, PersonLookupResult } from "./cedula-lookup.gateway";
import { cedulaToNaturalPersonRuc, isValidCedula, provinceFromCedula } from "../cedula.validator";
import { splitRazonSocial } from "../razon-social.parser";

const SRI_RUC_ENDPOINT =
  "https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/obtenerPorNumerosRuc";

type SriContribuyente = {
  numeroRuc: string;
  razonSocial: string;
  estadoContribuyenteRuc: string;
  tipoContribuyente: string;
};

/**
 * El RUC de una persona natural en Ecuador es la cédula + "001" — el propio
 * SRI lo resuelve así, y `razonSocial` para persona natural es el nombre
 * legal completo (misma fuente que el Registro Civil, que no expone un
 * servicio público propio). Confirmado en vivo contra el RUC institucional
 * del SRI (1760013210001) antes de construir esto — endpoint público, sin
 * autenticación, JSON directo. Ver ARCHITECTURE.md §13.
 *
 * `razonSocial` de persona natural sigue el orden fijo de cédula:
 * "APELLIDO1 APELLIDO2 NOMBRE1 [NOMBRE2]" — se parte ahí (2 primeras
 * palabras = apellidos), es la convención real, no una suposición.
 */
export class SriCedulaLookupAdapter implements CedulaLookupGateway {
  async lookupPerson(documentNumber: string): Promise<PersonLookupResult> {
    if (!isValidCedula(documentNumber)) {
      return { status: "ERROR", message: "Cédula inválida (dígito verificador no coincide)" };
    }

    const ruc = cedulaToNaturalPersonRuc(documentNumber);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(`${SRI_RUC_ENDPOINT}?&ruc=${ruc}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });

      if (res.status === 204) return { status: "NOT_FOUND" };
      if (!res.ok) return { status: "ERROR", message: `SRI respondió ${res.status}` };

      const body: SriContribuyente[] = await res.json();
      const record = body[0];
      if (!record?.razonSocial) return { status: "NOT_FOUND" };

      const { firstName, lastName } = splitRazonSocial(record.razonSocial);

      return {
        status: "FOUND",
        firstName,
        lastName,
        fullName: record.razonSocial,
        province: provinceFromCedula(documentNumber),
      };
    } catch (err) {
      const message = err instanceof Error && err.name === "AbortError" ? "SRI no respondió a tiempo" : "No se pudo contactar al SRI";
      return { status: "ERROR", message };
    } finally {
      clearTimeout(timeout);
    }
  }
}
