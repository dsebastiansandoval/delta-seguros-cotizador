# Delta Check

Cotizador comparativo para agentes de un broker de seguros. Ver `../ARCHITECTURE.md` (arquitectura completa), `../EXCEL-AUDIT.md` (auditoría del Excel original) y `../README.md` (contexto de negocio y presupuesto).

## Estado actual

**Fase 1 completa**, probada de punta a punta (navegador + ejecución directa de los servicios de dominio, no solo tests aislados):

- Login (dev) → formulario de cliente/vehículo → cotización → comparador contra las 13 aseguradoras de Autos, con Latina y Cóndor calculando la prima real y las demás en digitación manual.
- **Digitación manual funcional**: cada fila pendiente tiene un campo real para que el ejecutivo escriba la prima que le cotizaron por teléfono — recalcula impuestos con la misma fórmula, y reordena el ranking.
- **Auto x Km**: modalidad completa — grilla de 13 aseguradoras × 6 rangos de km, 100% digitación manual (confirmado en el Excel que ninguna aseguradora tiene tabla para esta modalidad).
- **Carátula en PDF**: se genera con los datos reales de la cotización y la aseguradora más barata ya cotizada — mismo texto de coberturas/cláusulas/aclaratorio que la hoja `CARATULA` del Excel.

**Fase 2 (Salud) completa** — a diferencia de Autos, el Excel SÍ tiene motor de tarifas real para Salud (EXCEL-AUDIT.md §2.3): titular + hasta 3 dependientes, comparador contra las 8 aseguradoras. **7 de las 8 calculan la prima real** por edad/sexo/región (sumando el precio individual de cada miembro de la familia), todas con rango confirmado por la propia fórmula VLOOKUP de cada hoja de aseguradora, no por posición/rótulo cercano:

- **BMI** (Sigma, 6 combinaciones región×deducible), **Humana** (5 planes).
- **Confiamed** (4 tramos × RED1/RED2 × con/sin maternidad), **SaludSA** (11 planes/deducibles, con caso especial para menores de 2 años), **Pro** (2 planes), **VB** (2 planes dentales).
- **Salud genérica** — la más rica: 9 productos (Star/Sky/Pro con sus variantes de deducible, 35 planes en total), cada uno con tabla separada para adultos (≥18) y niños (&lt;18). Un producto (Sky 70 Plus-200) no tiene datos de niño en el Excel — esas 4 combinaciones quedan sin sembrar en vez de inventar un precio.
- **Bupa** es 100% manual — su hoja no tiene una sola fórmula VLOOKUP, confirmado que no hay tabla en el archivo.

Importante: **Salud no aplica IVA/SB/Seguro Campesino** — confirmado que ninguna hoja de Salud referencia esos impuestos, a diferencia de Autos. Y dos hallazgos de datos reales que corrigieron la extracción:

- En **VB** el Excel guarda el HASTA de cada tramo igual al DESDE del siguiente (p. ej. `35-40` y `40-45`), pero `VLOOKUP(...,TRUE)` solo usa la columna DESDE (aproximación) — la columna HASTA es cosmética. La siembra corrige esto (HASTA efectivo = siguiente DESDE − 1) para que la edad límite no matchee dos tramos a la vez.
- En **Salud genérica**, un bloque que en una pasada anterior de la auditoría se había atribuido a SaludSA (por rótulos "Star"/"Sky" cercanos) en realidad pertenece a la propia hoja `SALUD` — la fórmula real de `SALUDSA` apunta a una zona de columnas completamente distinta. Corregido en EXCEL-AUDIT.md §2.3.

**Fase 3 (Cartera/Comisiones/Siniestros) completa** — desde el comparador (Autos o Salud), cada opción ya cotizada tiene un enlace "Emitir póliza" que crea la póliza **y** su comisión pendiente en la misma transacción (regla confirmada en la propia macro del Excel — `ALTA_EN_BASE_PENDIENTE` escribe en `BASE_PENDIENTE` y en `BASE_COMISIONES` a la vez, ver EXCEL-AUDIT.md §4). Desde `/cartera`: asignar número de póliza, marcar pagada, generar cuotas (1-12, mismo límite que `BASE_PENDIENTE`) y marcarlas pagadas una por una, cancelar con motivo, reportar un siniestro. Desde `/comisiones`: fijar el % (texto libre en el Excel, sin tabla — EXCEL-AUDIT.md §2.5) y marcar comisionada; un agente sin permiso de ver todas las comisiones cae automáticamente a ver solo las propias. Desde `/siniestros`: lista y cambio de estado (REPORTADO/APROBADO/REPARADO). Los estados de cartera/comisiones/siniestros son diseño de Delta Check, no un vocabulario extraído del Excel — confirmado que `ESTATUS` es texto libre en esas 5 hojas, sin lista de validación (ver nota en `src/db/schema/enums.ts`).

**Fase 3 completa** con KPIs y ARCO — el Excel no traía un tablero real que reproducir (`DASHBOARD`/`BASE DASHBOARD` están vacías), así que `/dashboard` son métricas propias de Delta Check sobre lo que el dominio ya genera: cotizaciones por estado/ramo, conversión a póliza, cartera vigente, comisiones pendientes/comisionadas, siniestros por estado. Derechos **ARCO** en `/cumplimiento`: cualquier agente registra el pedido que el cliente le hizo (`/cumplimiento/nueva`, busca por documento); SUPERVISOR/ADMIN lo procesa — Acceso exporta todo el dato crudo del titular, Rectificación corrige nombre/contacto, Cancelación redacta el contacto siempre y el nombre solo si el cliente nunca tuvo una póliza (nunca se borra la fila — hay obligación legal de conservar historial de pólizas/siniestros), Oposición deja un flag de no-marketing listo para cuando exista ese pipeline. Ver ARCHITECTURE.md §14 para el detalle y la nota de que el criterio de retención de Cancelación es un default de ingeniería, no asesoría legal confirmada.

Falta para Fase 3+: credenciales reales de Microsoft/Google (hoy solo hay un login de desarrollo, ver `src/lib/auth.ts`).

**Autocompletar desde cédula (SRI)** — igual que otros cotizadores en línea de Ecuador: en ambos formularios de nueva cotización, un botón "Buscar en SRI" junto a Documento trae el nombre legal real desde el RUC de persona natural (cédula + `001`, fuente pública y sin autenticación del SRI, confirmada en vivo). Se investigó también placa→datos del vehículo (ANT) y avalúo comercial (PatioTuerca/SRI vehicular, y 5 cotizadores de la competencia) — ninguno tiene API pública real ni resuelve esto tampoco (ni Zurich), así que no se construyó nada sobre un endpoint no documentado sin autorización; ver ARCHITECTURE.md §13 para el detalle de qué se investigó y por qué (incluye el hallazgo de que Prodeseg opera el cotizador embebido en PatioTuerca).

**Catálogo de marcas de vehículo** — el selector "Marca" de Nueva cotización — Autos ya no es texto libre: trae 66 marcas reales curadas del mercado ecuatoriano (con "Otra" como salida para lo que falte). El Excel tenía este dropdown originalmente pero su lista de origen se perdió (`DATOS VH!D9` apunta a `#REF!`); ver ARCHITECTURE.md §15.

**Referencia de precio a PatioTuerca** — junto a Valor comercial, un botón abre en pestaña nueva la guía de precios real de PatioTuerca para la marca/modelo/año que el agente ya escribió (`ecuador.patiotuerca.com/precio/autos/{marca}/{modelo}/{año}` — ese precio existe de verdad, solo que no está detrás de una API pública sino incrustado en el HTML de cada página, así que esto es un enlace, no una integración — ver ARCHITECTURE.md §16). Ningún dato de PatioTuerca entra al sistema.

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
