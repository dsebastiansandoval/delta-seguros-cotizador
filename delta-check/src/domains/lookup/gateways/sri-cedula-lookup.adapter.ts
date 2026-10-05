import type { DocumentLookupGateway, DocumentLookupResult } from "./cedula-lookup.gateway";
import { cedulaToNaturalPersonRuc, isNaturalPersonRuc, isValidCedula, isValidRuc, provinceFromCedula } from "../cedula.validator";
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
 * autenticación, JSON directo, y acepta cualquier RUC de 13 dígitos, no
 * solo los derivados de cédula (ese mismo RUC de prueba es de una entidad
 * pública, no de una persona). Ver ARCHITECTURE.md §13.
 *
 * `razonSocial` de persona natural sigue el orden fijo de cédula:
 * "APELLIDO1 APELLIDO2 NOMBRE1 [NOMBRE2]" — se parte ahí (2 primeras
 * palabras = apellidos), es la convención real, no una suposición. Para
 * sociedades (RUC con tercer dígito 6 o 9), `razonSocial` ya es el nombre
 * de la empresa tal cual — no se parte.
 */
async function queryRuc(ruc: string): Promise<DocumentLookupResult> {
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

    if (isNaturalPersonRuc(ruc)) {
      const { firstName, lastName } = splitRazonSocial(record.razonSocial);
      return {
        status: "FOUND",
        kind: "NATURAL",
        firstName,
        lastName,
        fullName: record.razonSocial,
        province: provinceFromCedula(ruc.slice(0, 10)),
      };
    }

    return { status: "FOUND", kind: "JURIDICA", businessName: record.razonSocial };
  } catch (err) {
    const message = err instanceof Error && err.name === "AbortError" ? "SRI no respondió a tiempo" : "No se pudo contactar al SRI";
    return { status: "ERROR", message };
  } finally {
    clearTimeout(timeout);
  }
}

export class SriCedulaLookupAdapter implements DocumentLookupGateway {
  async lookupByCedula(documentNumber: string): Promise<DocumentLookupResult> {
    if (!isValidCedula(documentNumber)) {
      return { status: "ERROR", message: "Cédula inválida (dígito verificador no coincide)" };
    }
    return queryRuc(cedulaToNaturalPersonRuc(documentNumber));
  }

  async lookupByRuc(ruc: string): Promise<DocumentLookupResult> {
    if (!isValidRuc(ruc)) {
      return { status: "ERROR", message: "RUC inválido (debe tener 13 dígitos)" };
    }
    return queryRuc(ruc);
  }
}
