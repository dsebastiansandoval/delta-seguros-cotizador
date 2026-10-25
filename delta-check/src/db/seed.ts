/**
 * Datos base 🌐 (compartidos entre tenants) — roles, permisos y el catálogo
 * real de aseguradoras/coberturas identificado en EXCEL-AUDIT.md. No siembra
 * ningún tenant ni dato de negocio: eso se crea por onboarding, no por seed.
 *
 * Uso: npm run db:seed
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { roles, permissions, rolePermissions } from "./schema/identity";
import { insurers, coverages, healthPlanCoverages, vehicleBrands, vehicleModels } from "./schema/catalog";

/**
 * Parser CSV mínimo (RFC4180: comillas para escapar comas/saltos de línea,
 * `""` para una comilla literal) — suficiente para el CSV de
 * `salud_oferta_am_coberturas_RAW.csv` sin sumar una dependencia nueva solo
 * para esto.
 */
function parseCsv(raw: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inQuotes) {
      if (c === '"' && raw[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && raw[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...dataRows] = rows;
  return dataRows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

async function seedRoles() {
  const roleRows = [
    { code: "PLATFORM_ADMIN" as const, name: "Administrador de plataforma" },
    { code: "ADMIN" as const, name: "Administrador" },
    { code: "SUPERVISOR" as const, name: "Supervisor" },
    { code: "AGENTE" as const, name: "Agente" },
    { code: "LECTOR" as const, name: "Lector" },
  ];
  await db.insert(roles).values(roleRows).onConflictDoNothing({ target: roles.code });

  const permissionCodes = [
    "quote:create",
    "quote:read",
    "quote:read_all", // supervisor: ve las de todos los agentes
    "rate:edit",
    "commission:read_own",
    "commission:read_all",
    "commission:manage", // fijar % comisión, marcar pagada — Fase 3
    "policy:manage", // emitir/cancelar póliza, cuotas — Fase 3 (EXCEL-AUDIT.md §4)
    "claim:manage", // registrar/actualizar siniestro — Fase 3
    "compliance:manage", // procesar solicitud ARCO (rectificar/anonimizar/oposición) — Fase 3
    "client:read_pii",
    "user:manage",
    "org:manage", // PLATFORM_ADMIN
  ];
  await db
    .insert(permissions)
    .values(permissionCodes.map((code) => ({ code })))
    .onConflictDoNothing({ target: permissions.code });

  // Matriz rol → permiso (ARCHITECTURE.md §8.4 / §1b RBAC con tenant)
  const grants: Record<string, string[]> = {
    PLATFORM_ADMIN: permissionCodes, // todo, cross-tenant
    ADMIN: permissionCodes.filter((p) => p !== "org:manage"),
    SUPERVISOR: [
      "quote:create",
      "quote:read",
      "quote:read_all",
      "commission:read_own",
      "commission:read_all",
      "commission:manage",
      "policy:manage",
      "claim:manage",
      "compliance:manage",
      "client:read_pii",
    ],
    AGENTE: [
      "quote:create",
      "quote:read",
      "commission:read_own",
      "policy:manage",
      "claim:manage",
      "client:read_pii",
    ],
    LECTOR: ["quote:read"],
  };

  const allRoles = await db.select().from(roles);
  const allPermissions = await db.select().from(permissions);

  for (const [roleCode, permCodes] of Object.entries(grants)) {
    const role = allRoles.find((r) => r.code === roleCode);
    if (!role) continue;
    const rows = permCodes
      .map((code) => allPermissions.find((p) => p.code === code))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({ roleId: role.id, permissionId: p.id }));
    if (rows.length) {
      await db.insert(rolePermissions).values(rows).onConflictDoNothing();
    }
  }
}

async function seedCatalog() {
  // Autos — 13 aseguradoras confirmadas en EXCEL-AUDIT.md §2.1.
  // integrationMode: API solo para las que ya tienen motor de tasas real
  // en el Excel (Latina y Cóndor); el resto arranca en MANUAL.
  const autoInsurers = [
    "AIG", "SESA", "GENERALI", "ZURICH", "SWEADEN", "ATLANTIDA", "ALIANZA",
    "CONSTITUCION", "UNIDOS", "LATINA", "ASEGSUR", "CHUBB", "CONDOR",
  ];
  // Salud — 8 aseguradoras confirmadas en EXCEL-AUDIT.md §2.3.
  const healthInsurers = ["BMI", "HUMANA", "SALUDSA", "SALUD", "CONFIAMED", "BUPA", "PRO", "VB"];

  await db
    .insert(insurers)
    .values([
      ...autoInsurers.map((code) => ({
        code,
        name: code,
        branch: "AUTOS" as const,
        integrationMode: (code === "LATINA" || code === "CONDOR" ? "API" : "MANUAL") as
          | "API"
          | "MANUAL",
        supportsKm: code === "AIG",
      })),
      ...healthInsurers.map((code) => ({ code, name: code, branch: "SALUD" as const })),
    ])
    .onConflictDoNothing({ target: insurers.code });

  // Coberturas de Autos — nombres tal como aparecen en la hoja OFERTA (EXCEL-AUDIT.md §2).
  const autoCoverages: Array<{ code: string; name: string; valueType: "BOOLEAN" | "AMOUNT" | "TEXT" }> = [
    { code: "PERDIDA_PARCIAL", name: "Pérdida Parcial por Daño", valueType: "BOOLEAN" },
    { code: "PERDIDA_TOTAL", name: "Pérdida Total por Daño", valueType: "BOOLEAN" },
    { code: "ROBO_PARCIAL", name: "Robo Parcial", valueType: "BOOLEAN" },
    { code: "ROBO_TOTAL", name: "Robo Total", valueType: "BOOLEAN" },
    { code: "RC", name: "Responsabilidad civil", valueType: "AMOUNT" },
    { code: "AP", name: "Accidentes personales", valueType: "AMOUNT" },
    { code: "GM", name: "Gastos médicos", valueType: "AMOUNT" },
    { code: "HONORARIOS_LEGALES", name: "Honorarios legales", valueType: "BOOLEAN" },
    { code: "ASISTENCIA_MECANICA", name: "Asistencia mecánica", valueType: "BOOLEAN" },
    { code: "AUTO_SUSTITUTO", name: "Auto sustituto", valueType: "TEXT" },
    { code: "ACCESORIOS_EXTRAS", name: "Accesorios extras", valueType: "TEXT" },
    { code: "AMPARO_PATRIMONIAL", name: "Amparo Patrimonial", valueType: "BOOLEAN" },
    { code: "ASISTENCIA_EXEQUIAL", name: "Asistencia exequial", valueType: "BOOLEAN" },
    { code: "CONDUCTOR_ELEGIDO", name: "Conductor elegido", valueType: "BOOLEAN" },
    // Las 4 que faltaban para llegar a las 18 filas reales de la
    // comparativa (EXCEL-AUDIT.md, PDF de ejemplo real vía WhatsApp) — se
    // habían quedado afuera de la primera pasada.
    { code: "CONCESIONARIOS", name: "Concesionarios", valueType: "TEXT" }, // "2 años", "No otorga"...
    { code: "AIRBAG", name: "Air-bag", valueType: "TEXT" }, // "100%" en todas las aseguradoras del ejemplo real
    { code: "LICENCIA_CADUCADA", name: "Licencia caducada", valueType: "TEXT" }, // "30 días", "90 días", "No otorga"
    { code: "PACTO_ANDINO", name: "Cobertura pacto Andino", valueType: "BOOLEAN" },
    // Sección DEDUCIBLES de la hoja OFERTA (filas 33-34) — texto descriptivo
    // por aseguradora, ej. "10% VS, 1% VA, mínimo USD 200 (el que sea
    // mayor)". Confirmado en el PDF real de comparativa (SRA ROBLES).
    { code: "DEDUCIBLE_PARCIAL", name: "Deducible — Pérdidas Parciales", valueType: "TEXT" },
    { code: "DEDUCIBLE_TOTAL", name: "Deducible — Pérdida Total", valueType: "TEXT" },
  ];

  const healthCoverages: Array<{ code: string; name: string; valueType: "BOOLEAN" | "AMOUNT" | "TEXT" }> = [
    { code: "COPAGO", name: "Copago", valueType: "AMOUNT" },
    { code: "SUBLIMITE", name: "Sublímite", valueType: "AMOUNT" },
    { code: "CARENCIA", name: "Carencia", valueType: "TEXT" },
  ];

  await db
    .insert(coverages)
    .values([
      ...autoCoverages.map((c, i) => ({ ...c, branch: "AUTOS" as const, displayOrder: i })),
      ...healthCoverages.map((c, i) => ({ ...c, branch: "SALUD" as const, displayOrder: i })),
    ])
    .onConflictDoNothing({ target: coverages.code });
}

/**
 * Catálogo de marcas para el selector de "Nueva cotización — Autos" (ver
 * comentario en src/db/schema/catalog.ts sobre por qué no viene del Excel:
 * el dropdown original existía pero su lista de origen fue borrada,
 * `DATOS VH!D9` quedó apuntando a `#REF!`).
 *
 * Curado a partir del catálogo público real de marcas de Prodeseg
 * (`portal.prodeseg.com/.../api/public/marcas`, endpoint sin autenticación,
 * consultado en vivo — 192 marcas en total), filtrado a lo que aplica a
 * Autos LIVIANO/PICKUP: se excluyeron camiones pesados (Freightliner, Hino,
 * Fuso, Iveco, Scania, Kenworth…), motos (Harley Davidson, Yamaha, KTM…) y
 * maquinaria — ramos que Prodeseg cubre pero Delta Check no cotiza. También
 * se consolidaron variantes de un mismo fabricante que su catálogo trae
 * como entradas separadas (p. ej. "GWM (ANTES GREAT WALL)"/"GREAT WALL" →
 * una sola fila). Ordenado por prevalencia real en el mercado ecuatoriano,
 * no alfabético — las primeras ~10 son las que más se cotizan.
 *
 * No es exhaustivo a propósito: el formulario deja "Otra" como texto libre
 * para cualquier marca fuera de esta lista.
 */
async function seedVehicleBrands() {
  const brands = [
    // Mercado masivo — las más cotizadas en Ecuador
    "CHEVROLET", "KIA", "TOYOTA", "HYUNDAI", "NISSAN", "RENAULT", "FORD",
    "MAZDA", "SUZUKI", "VOLKSWAGEN",
    // Marcas chinas con presencia fuerte y creciente
    "GREAT WALL (GWM)", "CHERY", "JAC", "CHANGAN", "BYD", "DFSK", "FOTON",
    "MG", "GEELY", "HAVAL", "ZOTYE", "SOUEAST", "JMC", "OMODA", "JAECOO",
    "JETOUR", "KAIYI", "FORTHING", "CHANGHE", "SAIC WULING",
    // Resto de mercado masivo / utilitario
    "MITSUBISHI", "HONDA", "SUBARU", "PEUGEOT", "CITROËN", "FIAT", "DODGE",
    "RAM", "GMC", "JEEP", "ISUZU", "TATA", "MAHINDRA", "SSANGYONG (KGM)",
    "DAIHATSU", "DAEWOO", "LADA", "UAZ",
    // Premium / lujo
    "MERCEDES BENZ", "BMW", "AUDI", "VOLVO", "LAND ROVER", "JAGUAR", "MINI",
    "PORSCHE", "LEXUS", "CADILLAC", "ALFA ROMEO", "MASERATI",
    "LAMBORGHINI", "CHRYSLER", "SKODA", "SEAT", "OPEL", "SMART",
  ];

  await db
    .insert(vehicleBrands)
    .values(brands.map((name, i) => ({ name, displayOrder: i })))
    .onConflictDoNothing({ target: vehicleBrands.name });

  console.log(`  ${brands.length} marcas de vehículo sembradas`);
}

/**
 * Modelo en cascada según la marca — mismo origen real que
 * seedVehicleBrands() (Prodeseg, sin autenticación), consultado una sola
 * vez para las 66 marcas ya curadas y exportado a
 * reference-data/vehicle_models.json (950 modelos reales en total). Las
 * marcas que Delta Check consolida en un solo nombre (p. ej. "GREAT WALL
 * (GWM)") ya vienen fusionadas y sin duplicados en ese archivo.
 */
async function seedVehicleModels() {
  const referenceDataDir = join(process.cwd(), "..", "reference-data");
  const raw = readFileSync(join(referenceDataDir, "vehicle_models.json"), "utf-8");
  const modelsByBrand: Record<string, string[]> = JSON.parse(raw);

  let total = 0;
  for (const [brandName, models] of Object.entries(modelsByBrand)) {
    const [brand] = await db.select().from(vehicleBrands).where(eq(vehicleBrands.name, brandName));
    if (!brand) {
      console.warn(`  ⚠️  Marca "${brandName}" no está en vehicleBrands — se omiten sus modelos`);
      continue;
    }

    await db
      .insert(vehicleModels)
      .values(models.map((name, i) => ({ brandId: brand.id, name, displayOrder: i })))
      .onConflictDoNothing({ target: [vehicleModels.brandId, vehicleModels.name] });
    total += models.length;
  }

  console.log(`  ${total} modelos de vehículo sembrados (${Object.keys(modelsByBrand).length} marcas)`);
}

/**
 * Grilla de sublímites/copago/carencia por plan de Salud — extraída celda
 * por celda de `OFERTA AM` (script Python, ver comentario en
 * `reference-data/salud_oferta_am_coberturas_RAW.csv`), verificada contra
 * 2 PDFs reales de cotizaciones que Delta ya envió a clientes (coincide
 * exacto: $150 deducible Confiamed Red1-30K, 90% de $60 tope consulta
 * MetroHumana 50K, etc.). `insurerCode` en el CSV es el código real del
 * catálogo (`insurers.code`); `planCode` es el mismo valor que ya usa
 * `quoteOptions.planCode` (sembrado desde los JSON de tarifas reales) — el
 * join en `caratula-am.service.ts` es directo, sin tabla de traducción.
 */
async function seedHealthPlanCoverages() {
  const referenceDataDir = join(process.cwd(), "..", "reference-data");
  const raw = readFileSync(join(referenceDataDir, "salud_oferta_am_coberturas_RAW.csv"), "utf-8");
  const rows = parseCsv(raw);

  const allInsurers = await db.select().from(insurers);
  const insurerByCode = new Map(allInsurers.map((i) => [i.code, i]));

  const values: Array<{
    insurerId: string;
    planCode: string;
    section: string;
    label: string;
    displayOrder: number;
    copago: string | null;
    sublimite: string | null;
    carencia: string | null;
  }> = [];

  const missingInsurers = new Set<string>();
  for (const r of rows) {
    const insurer = insurerByCode.get(r.insurerCode);
    if (!insurer) {
      missingInsurers.add(r.insurerCode);
      continue;
    }
    values.push({
      insurerId: insurer.id,
      planCode: r.planCode,
      section: r.section,
      label: r.label,
      displayOrder: Number(r.displayOrder),
      copago: r.copago || null,
      sublimite: r.sublimite || null,
      carencia: r.carencia || null,
    });
  }
  if (missingInsurers.size > 0) {
    console.warn(`  ⚠️  Aseguradoras no encontradas en el catálogo: ${[...missingInsurers].join(", ")}`);
  }

  // Idempotente: se borra y se vuelve a insertar completo en cada corrida —
  // más simple que un onConflict con 3 columnas variables, y este catálogo
  // no tiene datos de negocio del tenant que proteger (es 🌐 global).
  await db.delete(healthPlanCoverages);
  const BATCH = 500;
  for (let i = 0; i < values.length; i += BATCH) {
    await db.insert(healthPlanCoverages).values(values.slice(i, i + BATCH));
  }
  console.log(`  ${values.length} filas de cobertura sembradas (${new Set(values.map((v) => v.planCode)).size} planes)`);
}

async function main() {
  console.log("Sembrando roles y permisos…");
  await seedRoles();
  console.log("Sembrando catálogo de aseguradoras y coberturas…");
  await seedCatalog();
  console.log("Sembrando catálogo de marcas de vehículo…");
  await seedVehicleBrands();
  console.log("Sembrando catálogo de modelos de vehículo…");
  await seedVehicleModels();
  console.log("Sembrando grilla de coberturas de Salud (OFERTA AM)…");
  await seedHealthPlanCoverages();
  console.log("Listo.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
