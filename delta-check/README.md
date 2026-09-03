# Delta Check

Cotizador comparativo para agentes de un broker de seguros. Ver `../ARCHITECTURE.md` (arquitectura completa), `../EXCEL-AUDIT.md` (auditoría del Excel original) y `../README.md` (contexto de negocio y presupuesto).

## Estado actual

**Fase 1 completa**, probada de punta a punta (navegador + ejecución directa de los servicios de dominio, no solo tests aislados):

- Login (dev) → formulario de cliente/vehículo → cotización → comparador contra las 13 aseguradoras de Autos, con Latina y Cóndor calculando la prima real y las demás en digitación manual.
- **Digitación manual funcional**: cada fila pendiente tiene un campo real para que el ejecutivo escriba la prima que le cotizaron por teléfono — recalcula impuestos con la misma fórmula, y reordena el ranking.
- **Auto x Km**: modalidad completa — grilla de 13 aseguradoras × 6 rangos de km, 100% digitación manual (confirmado en el Excel que ninguna aseguradora tiene tabla para esta modalidad).
- **Carátula en PDF**: se genera con los datos reales de la cotización y la aseguradora más barata ya cotizada — mismo texto de coberturas/cláusulas/aclaratorio que la hoja `CARATULA` del Excel.

**Fase 2 (Salud) completa** — a diferencia de Autos, el Excel SÍ tiene motor de tarifas real para Salud (EXCEL-AUDIT.md §2.3): titular + hasta 3 dependientes, comparador contra las 8 aseguradoras. De esas, 6 calculan la prima real por edad/sexo/región (sumando el precio individual de cada miembro de la familia), todas con rango confirmado por la propia fórmula VLOOKUP de cada hoja de aseguradora, no por posición/rótulo cercano:

- **BMI** (Sigma, 6 combinaciones región×deducible), **Humana** (5 planes).
- **Confiamed** (4 tramos × RED1/RED2 × con/sin maternidad), **SaludSA** (11 planes/deducibles, con caso especial para menores de 2 años), **Pro** (2 planes), **VB** (2 planes dentales).
- **Salud genérica** tiene su rango confirmado en el Excel pero sin sembrar todavía (estructura de 9 sub-bloques distinta a las demás, pendiente de mapear). **Bupa** es 100% manual — su hoja no tiene una sola fórmula VLOOKUP, confirmado que no hay tabla en el archivo.

Importante: **Salud no aplica IVA/SB/Seguro Campesino** — confirmado que ninguna hoja de Salud referencia esos impuestos, a diferencia de Autos. Y un hallazgo de datos real: en VB el Excel guarda el HASTA de cada tramo igual al DESDE del siguiente (p. ej. `35-40` y `40-45`), pero `VLOOKUP(...,TRUE)` solo usa la columna DESDE (aproximación) — la columna HASTA es cosmética. La siembra corrige esto (HASTA efectivo = siguiente DESDE − 1) para que la edad límite no matchee dos tramos a la vez.

Falta para Fase 3 en adelante: back-office (cartera/comisiones/siniestros), sembrar Salud genérica, y credenciales reales de Microsoft/Google (hoy solo hay un login de desarrollo, ver `src/lib/auth.ts`).

## Requisitos

- Node.js 20.9+ (usa v26 en este entorno)
- PostgreSQL 16+ corriendo localmente

## Arrancar en local

```bash
npm install
cp .env.example .env.local   # completar DATABASE_URL y AUTH_SECRET (npx auth secret)

createdb delta_check_dev

npm run db:migrate                                          # tablas
psql -d delta_check_dev -f src/db/migrations/rls/0001_row_level_security.sql   # políticas RLS — no la genera drizzle-kit, se aplica aparte
npm run db:seed                                              # roles, permisos, catálogo de aseguradoras (seguro en cualquier entorno)
npm run db:seed:dev                                          # organización Delta + usuario de login de prueba + tasas reales de Latina/Cóndor (SOLO dev/local)

npm run dev
```

`http://localhost:3000` — redirige a `/login` porque el `proxy.ts` exige sesión en todo lo que no sea público (ARCHITECTURE.md §8.1). El login real (Microsoft/Google) no está conectado todavía — falta configurar `AUTH_MICROSOFT_ENTRA_ID_*` / `AUTH_GOOGLE_*` en `.env.local` (ver ARCHITECTURE.md §11.3). En `NODE_ENV=development` hay un login de solo-email (`dev@deltaseguros.local` tras correr `db:seed:dev`) que nunca se registra en producción — ver el comentario en `src/lib/auth.ts`.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:generate` | Genera una migración SQL nueva a partir del esquema en `src/db/schema/` |
| `npm run db:migrate` | Aplica las migraciones generadas por Drizzle |
| `npm run db:studio` | UI de Drizzle Studio para explorar la base |
| `npm run db:seed` | Siembra roles, permisos y catálogo de aseguradoras/coberturas |
| `npm run db:seed:dev` | Organización Delta + usuario de login de prueba + tasas reales de Latina/Cóndor — solo dev |
| `npm run test` | Vitest — dominio (`premium.calculator` reproduce la fórmula real del Excel, verificado con números reales) |

## Multi-tenencia — importante antes de tocar el esquema

Toda tabla de negocio lleva `organization_id` y tiene una política RLS activa (ver `src/db/migrations/rls/0001_row_level_security.sql` y ARCHITECTURE.md §1b). **Ninguna query a esas tablas funciona sin pasar por `withOrganization()`** (`src/db/index.ts`) — sin fijar el tenant, Postgres rechaza la consulta en vez de devolver todo. Verificado a mano, no solo diseñado: ver el historial de este chat para la prueba de aislamiento real hecha con un rol no-superusuario.

Si agregas una tabla nueva de negocio:
1. Agrégala al esquema de Drizzle con `organizationId: organizationId()` (helper en `src/db/schema/_helpers.ts`).
2. Agrégala al arreglo de la migración de RLS (o escribe una política a mano si el caso no es el simple — como `rate_tables`/`rate_rules`, ver el archivo).
3. `npm run db:generate` para la tabla, y aplica la política RLS correspondiente antes de dar la tabla por lista.
