import { z } from "zod";
import { resolveAge } from "@/domains/shared/age";

function optionalText() {
  return z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());
}

/** Un <input type="date"> vacío también manda "" — mismo problema que optionalText(). */
function optionalDate() {
  return z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional());
}

/** Mismo problema, versión <select> — un <select> sin elegir manda "" también. */
function optionalGender() {
  return z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.enum(["MASCULINO", "FEMENINO"]).optional(),
  );
}

/**
 * Hasta 8 dependientes — antes el formulario traía 3 bloques fijos
 * (Dependiente 1/2/3); ahora el usuario puede ir agregando de a uno con
 * "+ Agregar dependiente" (ver NuevaCotizacionSaludForm.tsx), sin un tope
 * real de uso — 8 ya cubre cualquier grupo familiar real que se cotice acá.
 */
export const MAX_DEPENDENTS = 8;
type DependentIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

function dependentShape(n: number) {
  return {
    [`dep${n}BirthDate`]: optionalDate(),
    [`dep${n}AgeInput`]: optionalText(),
    [`dep${n}Gender`]: optionalGender(),
  };
}

const dependentsShape = Object.assign(
  {},
  ...Array.from({ length: MAX_DEPENDENTS }, (_, i) => dependentShape(i + 1)),
) as Record<string, ReturnType<typeof optionalDate> | ReturnType<typeof optionalText> | ReturnType<typeof optionalGender>>;

/**
 * Titular + hasta 8 dependientes — "NUMERO DE RIESGOS" / "DATOS AM" del
 * Excel (EXCEL-AUDIT.md). Cada dependiente es opcional; si no se llena
 * fecha de nacimiento ni edad, no se cuenta como miembro del grupo.
 *
 * Cada persona (titular o dependiente) acepta fecha de nacimiento O edad
 * directa, nunca ambas a la vez en el formulario (el checkbox "Edad" las
 * alterna) — a veces el agente no tiene la fecha exacta a mano, solo la
 * edad que le dio el cliente. `insured_members.age` (NOT NULL) sigue
 * siendo lo que persiste el dominio; si vino por fecha, se calcula acá
 * (calculateAge); si vino directa, se usa tal cual.
 */
// Sin personType: a diferencia de DATOS VH (Autos), DATOS AM nunca tuvo
// "JURIDICA" — "NOMBRES:"/"APELLIDOS:" son fijos ahí, sin fórmula
// condicional, y el titular solo tiene EDAD/GÉNERO. El contratante de Salud
// en Delta siempre es persona natural (confirmado contra el Excel real, no
// asumido) — documentType sigue aceptando RUC porque una persona natural
// también puede tener uno (cédula + "001").
const baseHealthQuoteSchema = z.object({
  // A pedido de Delta (17-nov): la cédula NO es obligatoria para Asistencia
  // Médica (a diferencia de Autos, donde el vehículo sí la exige) — basta
  // nombre + fecha de nacimiento del titular. Sin documento, el cliente se
  // busca/crea por nombre+fecha de nacimiento (ver clientService.upsertClient
  // en health-quote.actions.ts), por eso el refine de abajo exige fecha
  // exacta (no solo edad) cuando no hay documento.
  documentType: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["CEDULA", "RUC", "PASAPORTE"]).optional()),
  documentNumber: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(5, "Documento inválido").optional()),
  firstName: optionalText(),
  lastName: optionalText(),
  executive: optionalText(),
  vendor: optionalText(),

  region: z.enum(["SIERRA", "COSTA", "AUSTRO"]),
  titularBirthDate: optionalDate(),
  titularAgeInput: optionalText(),
  titularGender: z.enum(["MASCULINO", "FEMENINO"]),

  ...dependentsShape,
});

export const newHealthQuoteSchema = baseHealthQuoteSchema
  .refine((data) => resolveAge(data.titularBirthDate, data.titularAgeInput) != null, {
    message: "Fecha de nacimiento o edad del titular requerida",
    path: ["titularBirthDate"],
  })
  // path: ["form"] a propósito, no ["titularBirthDate"] — a diferencia del
  // refine de arriba (nunca se dispara en la práctica porque el campo ya es
  // `required` en el HTML), este SÍ es alcanzable desde la UI (cédula en
  // blanco + checkbox "Edad" marcado) y el formulario solo muestra
  // `state.errors.form`, no errores por campo.
  .refine((data) => data.documentNumber != null || data.titularBirthDate != null, {
    message: "Sin cédula, la fecha de nacimiento exacta del titular es obligatoria (no solo la edad)",
    path: ["form"],
  })
  .transform((data) => {
    const result = {
      ...data,
      titularAge: resolveAge(data.titularBirthDate, data.titularAgeInput)!,
    } as typeof data & { titularAge: number } & Record<string, unknown>;

    for (let i = 1; i <= MAX_DEPENDENTS; i++) {
      const birthDate = data[`dep${i}BirthDate` as keyof typeof data] as string | undefined;
      const ageInput = data[`dep${i}AgeInput` as keyof typeof data] as string | undefined;
      result[`dep${i}Age`] = resolveAge(birthDate, ageInput);
    }

    return result as typeof data & { titularAge: number } & Record<`dep${DependentIndex}Age`, number | undefined>;
  });

export type NewHealthQuoteInput = z.infer<typeof newHealthQuoteSchema>;
