import { z } from "zod";

function optionalText() {
  return z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());
}

/**
 * `z.coerce.number()` convierte `""` en `0` (Number("") === 0), no en
 * `undefined` — el mismo problema que los strings opcionales
 * (domains/clients/schemas/client.schema.ts), versión numérica. Un campo de
 * dependiente vacío se leería como "dependiente con edad 0" en vez de "no
 * hay dependiente". Se corta antes de la coerción.
 */
function optionalAge() {
  return z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(0).max(105).optional(),
  );
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
 * Excel (EXCEL-AUDIT.md). Cada dependiente es opcional; si no se llena edad,
 * no se cuenta como miembro del grupo.
 */
export const newHealthQuoteSchema = z.object({
  personType: z.enum(["NATURAL", "JURIDICA"]),
  documentType: z.enum(["CEDULA", "RUC", "PASAPORTE"]),
  documentNumber: z.string().min(5, "Documento inválido"),
  firstName: optionalText(),
  lastName: optionalText(),
  source: optionalText(),

  region: z.enum(["SIERRA", "COSTA", "AUSTRO"]),
  titularAge: z.coerce.number().int().min(0).max(105),
  titularGender: z.enum(["MASCULINO", "FEMENINO"]),

  dep1Age: optionalAge(),
  dep1Gender: optionalGender(),
  dep2Age: optionalAge(),
  dep2Gender: optionalGender(),
  dep3Age: optionalAge(),
  dep3Gender: optionalGender(),
});

export type NewHealthQuoteInput = z.infer<typeof newHealthQuoteSchema>;
