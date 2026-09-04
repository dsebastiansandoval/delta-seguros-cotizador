/**
 * Datos base 🌐 (compartidos entre tenants) — roles, permisos y el catálogo
 * real de aseguradoras/coberturas identificado en EXCEL-AUDIT.md. No siembra
 * ningún tenant ni dato de negocio: eso se crea por onboarding, no por seed.
 *
 * Uso: npm run db:seed
 */
import { db } from "./index";
import { roles, permissions, rolePermissions } from "./schema/identity";
import { insurers, coverages } from "./schema/catalog";

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
  ];

  await db
    .insert(coverages)
    .values(
      autoCoverages.map((c, i) => ({ ...c, branch: "AUTOS" as const, displayOrder: i })),
    )
    .onConflictDoNothing({ target: coverages.code });
}

async function main() {
  console.log("Sembrando roles y permisos…");
  await seedRoles();
  console.log("Sembrando catálogo de aseguradoras y coberturas…");
  await seedCatalog();
  console.log("Listo.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
