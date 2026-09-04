import { z } from "zod";
import { calculateAge } from "@/domains/shared/age";

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
 * Titular + hasta 3 dependientes — "NUMERO DE RIESGOS" / "DATOS AM" del
 * Excel (EXCEL-AUDIT.md). Cada dependiente es opcional; si no se llena
 * fecha de nacimiento, no se cuenta como miembro del grupo.
 *
 * Se pide fecha de nacimiento, no edad suelta — `insured_members.birth_date`
 * ya existía en el esquema desde Fase 2 sin usarse. La edad se calcula acá
 * (calculateAge, domains/shared/age.ts) y queda expuesta como
 * `titularAge`/`depNAge` para no tocar el resto del dominio (health-rate
 * sigue filtrando por edad, igual que siempre).
 */
const baseHealthQuoteSchema = z.object({
  personType: z.enum(["NATURAL", "JURIDICA"]),
  documentType: z.enum(["CEDULA", "RUC", "PASAPORTE"]),
  documentNumber: z.string().min(5, "Documento inválido"),
  firstName: optionalText(),
  lastName: optionalText(),
  source: optionalText(),

  region: z.enum(["SIERRA", "COSTA", "AUSTRO"]),
  titularBirthDate: z.string().min(1, "Fecha de nacimiento requerida"),
  titularGender: z.enum(["MASCULINO", "FEMENINO"]),

  dep1BirthDate: optionalDate(),
  dep1Gender: optionalGender(),
  dep2BirthDate: optionalDate(),
  dep2Gender: optionalGender(),
  dep3BirthDate: optionalDate(),
  dep3Gender: optionalGender(),
});

export const newHealthQuoteSchema = baseHealthQuoteSchema.transform((data) => ({
  ...data,
  titularAge: calculateAge(data.titularBirthDate),
  dep1Age: data.dep1BirthDate ? calculateAge(data.dep1BirthDate) : undefined,
  dep2Age: data.dep2BirthDate ? calculateAge(data.dep2BirthDate) : undefined,
  dep3Age: data.dep3BirthDate ? calculateAge(data.dep3BirthDate) : undefined,
}));

export type NewHealthQuoteInput = z.infer<typeof newHealthQuoteSchema>;
