# Delta Check

Cotizador comparativo para agentes de un broker de seguros. Ver `../ARCHITECTURE.md` (arquitectura completa), `../EXCEL-AUDIT.md` (auditoría del Excel original) y `../README.md` (contexto de negocio y presupuesto).

## Estado actual

Fase 1 en construcción. **Ya funciona de punta a punta, probado en el navegador, no solo en tests aislados:** login (dev) → formulario de cliente/vehículo → creación de cotización → comparador contra las 13 aseguradoras de Autos, con Latina y Cóndor calculando la prima real (tasa real de INFO GENERAL, impuestos ecuatorianos exactos) y las otras 11 marcadas "Pendiente — digitar", tal como opera hoy el Excel.

Falta: módulo de Salud, back-office (cartera/comisiones/siniestros), generación de carátula en PDF, y credenciales reales de Microsoft/Google (hoy solo hay un login de desarrollo, ver `src/lib/auth.ts`).

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
