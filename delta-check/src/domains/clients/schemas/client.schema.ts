import { z } from "zod";

/**
 * Un input de texto opcional de un <input> HTML manda `""` cuando queda
 * vacío, no `undefined` — `.optional()` a secas no cubre ese caso (`""` no
 * es `undefined`, así que `.min(1)` lo sigue rechazando). Bug real,
 * encontrado probando el formulario en el navegador, no en un test
 * aislado: ver ARCHITECTURE.md — el mismo espíritu que el bug de
 * `SET LOCAL` en src/db/index.ts, otro caso de "solo se ve corriendo la
 * app de verdad".
 */
function optionalText() {
  return z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());
}

function optionalNumber() {
  return z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().min(0).optional());
}

function optionalDate() {
  return z.preprocess((v) => (v === "" ? undefined : v), z.iso.date("Fecha inválida").optional());
}

/** DATOS VH!H20: fin de vigencia = inicio + 1 año. */
function oneYearAfter(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${Number(y) + 1}-${m}-${d}`;
}

function optionalYear() {
  return z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1).optional(),
  );
}

function optionalBodyType() {
  return z.preprocess((v) => (v === "" ? undefined : v), z.enum(["LIVIANO", "PICKUP"]).optional());
}

/**
 * Un vehículo (Riesgo N del Excel, EXCEL-AUDIT.md §5 — hasta 4 por
 * cotización, `quote_risks.risk_number`). Riesgo 2/3/4 son bloques
 * enteros opcionales (el agente puede no agregarlos) — todos los campos
 * quedan opcionales a nivel de Zod, mismo espíritu que
 * `dep1Age`/`dep2Age` en el esquema de Salud: la placa decide si el
 * bloque "cuenta" o no (`newAutoQuoteSchema.transform()` más abajo).
 * Se escriben los 4 bloques a mano en vez de generarlos con un loop
 * sobre claves calculadas — así Zod/TypeScript siguen conociendo cada
 * campo por su nombre real, no solo por su forma.
 */
function riskShape<S extends string>(suffix: S) {
  return {
    [`plate${suffix}`]: optionalText(),
    [`brand${suffix}`]: optionalText(),
    [`model${suffix}`]: optionalText(),
    [`year${suffix}`]: optionalYear(),
    [`bodyType${suffix}`]: optionalBodyType(),
    [`color${suffix}`]: optionalText(),
    [`commercialValueDollars${suffix}`]: optionalNumber(),
    [`extrasValueDollars${suffix}`]: optionalNumber(),
    [`hasTracker${suffix}`]: z.coerce.boolean().default(false),
    [`city${suffix}`]: optionalText(),
    [`province${suffix}`]: optionalText(),
  } as {
    [K in `plate${S}` | `brand${S}` | `model${S}`]: z.ZodOptional<z.ZodString>;
  } & {
    [K in `year${S}`]: z.ZodOptional<z.ZodNumber>;
  } & {
    [K in `bodyType${S}`]: z.ZodOptional<z.ZodEnum<{ LIVIANO: "LIVIANO"; PICKUP: "PICKUP" }>>;
  } & {
    [K in `color${S}` | `city${S}` | `province${S}`]: z.ZodOptional<z.ZodString>;
  } & {
    [K in `commercialValueDollars${S}` | `extrasValueDollars${S}`]: z.ZodOptional<z.ZodNumber>;
  } & {
    [K in `hasTracker${S}`]: z.ZodDefault<z.ZodBoolean>;
  };
}

/**
 * Un solo esquema, compartido entre el formulario (cliente) y la Server
 * Action (servidor) — ARCHITECTURE.md §1. Los nombres de campo replican
 * "DATOS VH" del Excel (EXCEL-AUDIT.md), no se inventaron de cero.
 */
const baseAutoQuoteSchema = z.object({
  // Modalidad — ANUAL (con motor de tasas para Latina/Cóndor) o POR_KM
  // (100% manual para las 13, EXCEL-AUDIT.md §11.4b).
  modality: z.enum(["ANUAL", "POR_KM"]).default("ANUAL"),

  // Renovación — campos reales de "DATOS VH" y BASE_VEHICULOS del Excel
  // (CIA ANTERIOR, No. POLIZA, INICIO/FIN VIGENCIA), restaurados por el
  // macro BUSCAR_BASE_VEHICULOS que nunca se había mapeado — ver
  // EXCEL-AUDIT.md §5. Todos opcionales: una cotización NUEVA no los trae.
  operationType: z.enum(["NUEVA", "RENOVACION"]).default("NUEVA"),
  previousInsurerId: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
  previousPolicyNumber: optionalText(),
  previousExpiryDate: optionalDate(),
  previousStartDate: optionalDate(),
  previousPremiumDollars: optionalNumber(),

  // Cliente
  personType: z.enum(["NATURAL", "JURIDICA"]),
  documentType: z.enum(["CEDULA", "RUC", "PASAPORTE"]),
  documentNumber: z.string().min(5, "Documento inválido"),
  firstName: optionalText(),
  lastName: optionalText(),
  businessName: optionalText(),
  // DATOS VH!C14: "NACIMIENTO:" en persona natural, "CONSTITUCION:" en
  // jurídica — misma celda del Excel, mismo campo acá (birthDate), solo
  // cambia el label en el formulario según personType. ESTADO CIVIL/GÉNERO
  // (C16/G12) no existen para jurídica — confirmado contra las fórmulas
  // reales de esas celdas (EXCEL-AUDIT.md).
  birthDate: optionalDate().refine((v) => !v || v <= new Date().toISOString().slice(0, 10), "La fecha no puede ser futura"),
  maritalStatus: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["CASADO", "DIVORCIADO", "SOLTERO", "UNION_DE_HECHO", "VIUDO"]).optional(),
  ),
  gender: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["MASCULINO", "FEMENINO"]).optional()),
  email: z.preprocess((v) => (v === "" ? undefined : v), z.email().optional()),
  phone: optionalText(),
  // FUENTE del Excel — lista cerrada de personas (INFO GENERAL!T15:T43),
  // no texto libre; ver ARCHITECTURE.md §24.
  source: optionalText(),
  // EJECUTIVO del Excel — lista separada de FUENTE (DATOS VH!D8, INFO
  // GENERAL!Y15:Y19); ver ARCHITECTURE.md §26.
  executive: optionalText(),

  ...riskShape("1"),
  ...riskShape("2"),
  ...riskShape("3"),
  ...riskShape("4"),
});

const riskSuffixes = ["1", "2", "3", "4"] as const;

function riskInputFor(data: z.infer<typeof baseAutoQuoteSchema>, n: (typeof riskSuffixes)[number]) {
  switch (n) {
    case "1":
      return {
        plate: data.plate1,
        brand: data.brand1,
        model: data.model1,
        year: data.year1,
        bodyType: data.bodyType1,
        color: data.color1,
        commercialValueDollars: data.commercialValueDollars1,
        extrasValueDollars: data.extrasValueDollars1,
        hasTracker: data.hasTracker1,
        city: data.city1,
        province: data.province1,
      };
    case "2":
      return {
        plate: data.plate2,
        brand: data.brand2,
        model: data.model2,
        year: data.year2,
        bodyType: data.bodyType2,
        color: data.color2,
        commercialValueDollars: data.commercialValueDollars2,
        extrasValueDollars: data.extrasValueDollars2,
        hasTracker: data.hasTracker2,
        city: data.city2,
        province: data.province2,
      };
    case "3":
      return {
        plate: data.plate3,
        brand: data.brand3,
        model: data.model3,
        year: data.year3,
        bodyType: data.bodyType3,
        color: data.color3,
        commercialValueDollars: data.commercialValueDollars3,
        extrasValueDollars: data.extrasValueDollars3,
        hasTracker: data.hasTracker3,
        city: data.city3,
        province: data.province3,
      };
    case "4":
      return {
        plate: data.plate4,
        brand: data.brand4,
        model: data.model4,
        year: data.year4,
        bodyType: data.bodyType4,
        color: data.color4,
        commercialValueDollars: data.commercialValueDollars4,
        extrasValueDollars: data.extrasValueDollars4,
        hasTracker: data.hasTracker4,
        city: data.city4,
        province: data.province4,
      };
  }
}

export const newAutoQuoteSchema = baseAutoQuoteSchema
  .refine((data) => Boolean(data.plate1 && data.brand1 && data.model1 && data.year1 && data.commercialValueDollars1), {
    message: "Completa los datos del vehículo — Riesgo 1",
    path: ["plate1"],
  })
  .transform((data) => {
    const vehicles = riskSuffixes
      .map((n) => riskInputFor(data, n))
      .filter((v): v is typeof v & { plate: string; brand: string; model: string; year: number } => Boolean(v.plate))
      .map((v) => ({
        plate: v.plate.toUpperCase(),
        brand: v.brand ?? "",
        model: v.model ?? "",
        year: v.year ?? new Date().getFullYear(),
        bodyType: v.bodyType ?? ("LIVIANO" as const),
        color: v.color,
        commercialValueDollars: v.commercialValueDollars ?? 0,
        extrasValueDollars: v.extrasValueDollars ?? 0,
        hasTracker: v.hasTracker,
        city: v.city,
        province: v.province,
      }));

    return {
      modality: data.modality,
      operationType: data.operationType,
      previousInsurerId: data.previousInsurerId,
      previousPolicyNumber: data.previousPolicyNumber,
      previousStartDate: data.previousStartDate,
      previousExpiryDate:
        data.previousExpiryDate ?? (data.previousStartDate ? oneYearAfter(data.previousStartDate) : undefined),
      previousPremiumDollars: data.previousPremiumDollars,
      personType: data.personType,
      documentType: data.documentType,
      documentNumber: data.documentNumber,
      firstName: data.personType === "NATURAL" ? data.firstName : undefined,
      lastName: data.personType === "NATURAL" ? data.lastName : undefined,
      businessName: data.personType === "JURIDICA" ? data.businessName : undefined,
      birthDate: data.birthDate,
      maritalStatus: data.personType === "NATURAL" ? data.maritalStatus : undefined,
      gender: data.personType === "NATURAL" ? data.gender : undefined,
      email: data.email,
      phone: data.phone,
      source: data.source,
      executive: data.executive,
      vehicles,
    };
  });

export type NewAutoQuoteInput = z.infer<typeof newAutoQuoteSchema>;
export type VehicleRiskInput = NewAutoQuoteInput["vehicles"][number];
