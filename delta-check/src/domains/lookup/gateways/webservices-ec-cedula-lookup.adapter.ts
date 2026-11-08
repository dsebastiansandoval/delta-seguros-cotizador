import { env } from "@/lib/env";
import type { DocumentLookupGateway, DocumentLookupResult } from "./cedula-lookup.gateway";
import { isNaturalPersonRuc, isValidCedula, isValidRuc, provinceFromCedula } from "../cedula.validator";

const WEBSERVICES_EC_BASE = "https://webservices.ec/api";

/**
 * Fallback de pago cuando el SRI no encuentra a la persona — el SRI solo
 * tiene RUC de persona natural si está registrada como contribuyente, así
 * que un empleado común (sin RUC) no sale ahí (confirmado con David: pasó
 * con la cédula de Amy/su novio). WebServices.ec consulta directo al
 * Registro Civil, $0.05/cédula — $0.04/RUC. Se encadena DESPUÉS del SRI en
 * `lookupPersonByDocument`, nunca en paralelo, para no pagar cuando el SRI
 * gratis ya resolvió.
 *
 * Endpoints confirmados en su sitio público (`GET /api/cedula/{id}` y
 * `/api/ruc/{id}`, `Authorization: Bearer <token>`), pero el formato exacto
 * del JSON de respuesta (nombres de los campos) NO estaba documentado de
 * forma legible al escribir esto — su doc de Postman no carga sin sesión.
 * `extractName` prueba varias llaves candidatas (convención típica de
 * cédula ecuatoriana: nombres/apellidos separados, o un nombre completo);
 * si ninguna calza, devuelve ERROR en vez de adivinar con datos
 * posiblemente incorrectos. **Hay que confirmar con una cédula real** la
 * primera vez que se configure `WEBSERVICES_EC_API_KEY` — si el campo real
 * no es ninguno de los candidatos, ajustar `extractName` con el nombre
 * real que devuelva (ver Verificación en el plan de la reunión 6-nov).
 */
function extractName(record: Record<string, unknown>): { firstName: string; lastName: string; fullName: string } | null {
  const get = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim().length > 0) return value.trim();
    }
    return undefined;
  };

  const nombres = get("nombres", "nombre", "names", "first_name", "firstName");
  const apellidos = get("apellidos", "apellido", "surnames", "last_name", "lastName");
  if (nombres && apellidos) {
    return { firstName: nombres, lastName: apellidos, fullName: `${apellidos} ${nombres}`.trim() };
  }

  const fullName = get(
    "nombre_completo",
    "nombres_completos",
    "nombreCompleto",
    "full_name",
    "fullName",
    "razon_social",
    "razonSocial",
  );
  if (fullName) {
    const words = fullName.split(/\s+/).filter(Boolean);
    const lastNameWordCount = words.length >= 2 ? Math.min(2, words.length - 1) : 0;
    return {
      lastName: words.slice(0, lastNameWordCount).join(" "),
      firstName: words.slice(lastNameWordCount).join(" "),
      fullName,
    };
  }

  return null;
}

function extractBusinessName(record: Record<string, unknown>): string | undefined {
  for (const key of ["razon_social", "razonSocial", "nombre_comercial", "business_name", "businessName"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

export class WebServicesEcCedulaLookupAdapter implements DocumentLookupGateway {
  async lookupByCedula(cedula: string): Promise<DocumentLookupResult> {
    if (!isValidCedula(cedula)) {
      return { status: "ERROR", message: "Cédula inválida (dígito verificador no coincide)" };
    }
    return this.query("cedula", cedula, true, provinceFromCedula(cedula));
  }

  async lookupByRuc(ruc: string): Promise<DocumentLookupResult> {
    if (!isValidRuc(ruc)) {
      return { status: "ERROR", message: "RUC inválido (debe tener 13 dígitos)" };
    }
    return this.query("ruc", ruc, isNaturalPersonRuc(ruc), provinceFromCedula(ruc.slice(0, 10)));
  }

  private async query(
    kind: "cedula" | "ruc",
    documentNumber: string,
    natural: boolean,
    province: string | null,
  ): Promise<DocumentLookupResult> {
    if (!env.WEBSERVICES_EC_API_KEY) {
      return { status: "ERROR", message: "Fallback de cédula no configurado (falta WEBSERVICES_EC_API_KEY)" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(`${WEBSERVICES_EC_BASE}/${kind}/${documentNumber}`, {
        headers: { Authorization: `Bearer ${env.WEBSERVICES_EC_API_KEY}`, Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });

      if (res.status === 404) return { status: "NOT_FOUND" };
      if (!res.ok) return { status: "ERROR", message: `WebServices.ec respondió ${res.status}` };

      const body = await res.json();
      const record = (body?.data ?? body ?? {}) as Record<string, unknown>;

      if (!natural) {
        const businessName = extractBusinessName(record);
        if (!businessName) return { status: "ERROR", message: "WebServices.ec respondió pero no se reconoció el formato (confirmar contra Postman)" };
        return { status: "FOUND", kind: "JURIDICA", businessName };
      }

      const name = extractName(record);
      if (!name) return { status: "ERROR", message: "WebServices.ec respondió pero no se reconoció el formato (confirmar contra Postman)" };
      return { status: "FOUND", kind: "NATURAL", ...name, province };
    } catch (err) {
      const message =
        err instanceof Error && err.name === "AbortError" ? "WebServices.ec no respondió a tiempo" : "No se pudo contactar a WebServices.ec";
      return { status: "ERROR", message };
    } finally {
      clearTimeout(timeout);
    }
  }
}
