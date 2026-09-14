# Delta Check — Arquitectura y Guía de Desarrollo

> Documento operativo. Es la fuente de verdad para el desarrollo: estructura, esquema de datos, convenciones y seguridad. Se actualiza al cerrar cada fase.

- **Producto:** Delta Check — cotizador comparativo para agentes de un broker de seguros.
- **Plataforma:** Web responsive (Next.js App Router). No hay app nativa en el alcance.
- **Reemplaza:** `COTIZADOR DELTA.xlsm` (30 hojas, macros VBA).
- **Usuarios:** agentes/ejecutivos del broker. **No es un portal público de clientes.**
- **Cliente inicial:** Delta Seguros. **Horizonte de negocio:** el producto se planea arrendar a otros brokers como SaaS — la arquitectura se diseña multi-tenant desde Fase 1 (§1b), no como algo que se agrega después.

---

## 1. Stack

| Capa | Elección | Nota |
|---|---|---|
| Framework | Next.js 16 (App Router, Server Components) | RSC por defecto; `"use client"` solo en hojas interactivas |
| Lenguaje | TypeScript `strict: true` | `noUncheckedIndexedAccess` activo |
| UI | Tailwind CSS + shadcn/ui | Tokens de marca Delta (§7) |
| DB | PostgreSQL 16 | Fuente de verdad transaccional |
| ORM | Drizzle ORM | SQL-first, migraciones versionadas en repo |
| Cache/colas | Redis (Upstash) | Rate limiting, cache de tasas, sesiones de cotización |
| Auth | Auth.js v5 (NextAuth) | Microsoft Entra ID + Google + Email (magic link) |
| Validación | Zod | Un solo esquema compartido cliente/servidor |
| PDF | React-PDF (`@react-pdf/renderer`) en Server Action | Genera la carátula |
| Tests | Vitest + Playwright | Dominio con Vitest; flujo de cotización con Playwright |

> **Nota Next.js 16:** el archivo de interceptación de requests (guard de sesión, RBAC por ruta, headers de CSP) se llama **`proxy.ts`** con función exportada `proxy`, no `middleware.ts`/`middleware` — Next.js 16 renombró la convención y corre siempre en runtime `nodejs` (ya no en `edge`). Verificado contra los docs versionados que trae instalado `node_modules/next/dist/docs/` — no asumido de memoria.
>
> **Nota Auth.js v5:** `Session` se declara en `@auth/core/types`, no en `next-auth` (que solo lo re-exporta) — pero incluso augmentando el módulo correcto, la fusión de tipos no aplicó de forma confiable en este proyecto (`Session extends DefaultSession {}` con cuerpo propio vacío). Se resolvió centralizando la sesión en `getAppSession()` (`src/lib/auth.ts`) — un solo cast, documentado, en un solo lugar — en vez de perseguir el caso límite de TypeScript. Cualquier código nuevo que necesite `organizationId`/`userId` de la sesión usa ese helper, nunca `auth()` crudo.

**Por qué este stack soporta las APIs futuras (Fase 4):** la capa de aseguradoras se define como un *puerto* (`InsurerGateway`). En Fase 1 el adaptador es `ManualRateAdapter` (lee tasas de la BD); en Fase 4 se agregan `AigApiAdapter`, `ZurichApiAdapter`, etc. implementando la misma interfaz. **Ningún componente ni servicio de cotización cambia** cuando se conecta una API real — solo se registra otro adaptador. Ver §5.

---

## 1b. Multi-tenencia — se construye desde Fase 1

Confirmaste que a futuro se arrienda a otros brokers. Esto **no se puede agregar después sin reescribir el esquema completo** — cada tabla de negocio necesita saber de qué broker es el dato desde el día uno, o la migración posterior implica tocar cada fila de cada tabla y auditar cada query en busca de fugas entre clientes. Se construye ahora, aunque el único inquilino por un buen tiempo sea Delta.

### Estrategia: una sola base de datos, `organization_id` + Row-Level Security de Postgres

No uso base de datos separada ni schema separado por broker. Con un equipo de una persona y el volumen de datos de una correduría (miles de cotizaciones, no millones), esa separación solo agrega costo operativo — N migraciones, N backups, N pools de conexión — sin comprarte una garantía de aislamiento que RLS no te dé ya.

**Cómo funciona la garantía:** cada tabla de negocio lleva `organization_id`. Postgres tiene una política RLS que dice, literalmente, "esta fila solo es visible si `organization_id` = el tenant de la sesión actual". Esa política vive **en la base de datos**, no en el código de la aplicación — un bug en un Server Action que olvide filtrar por tenant no puede filtrar datos de otro broker, porque Postgres los rechaza antes de que lleguen a la app. Es la diferencia entre "confiar en que cada query esté bien escrita" y "que sea estructuralmente imposible escribirla mal".

```sql
-- Se activa una vez por tabla de negocio
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON clients
  USING (organization_id = current_setting('app.current_org_id')::uuid);
```

```ts
// Cada request de un agente autenticado fija el tenant antes de cualquier query.
// No hay forma de "olvidarlo" porque vive en el middleware de sesión, no en cada handler.
//
// OJO: `SET LOCAL x = $1` no es SQL válido — Postgres solo acepta literales
// ahí, no parámetros (bug real, encontrado probando el flujo completo en el
// navegador). set_config(name, value, is_local) sí acepta parámetros;
// is_local=true es el equivalente exacto de SET LOCAL.
await db.execute(sql`SELECT set_config('app.current_org_id', ${session.organizationId}, true)`);
```

### Qué es del tenant y qué es compartido

| Dato | ¿Tenant-scoped? | Razón |
|---|---|---|
| `organizations` (el broker mismo) | — es el tenant | id, nombre, subdominio, marca (logo/colores para white-label), plan |
| `insurers` (catálogo de aseguradoras reales), `coverages` (catálogo de coberturas) | ❌ Compartido | AIG, Zurich, etc. son las mismas para cualquier broker ecuatoriano — no tiene sentido que cada tenant las recree |
| `rate_tables`, `rate_rules`, `deductible_rules`, `insurer_coverages` | ✅ Tenant-scoped, con modo plantilla — ver abajo | Cada broker tiene **tasas y comisiones negociadas distintas** con la misma aseguradora |
| `clients`, `vehicles`, `quotes`, `quote_risks`, `quote_options`, `policies`, `commissions`, `claims`, `consents`, `audit_logs` | ✅ Tenant-scoped, sin excepción | Cartera de cada broker, aislada por completo |
| `organization_integrations` (SoftSeguros y futuros sistemas externos) | ✅ Tenant-scoped | Ver §5b — esto es justo lo que resuelve tu requisito de que sea opcional |

### `rate_tables` como plantilla — confirmado que sí

Las tasas y comisiones de Delta con cada aseguradora **sí pueden servir de referencia para acelerar el onboarding de un broker nuevo**. No las comparto en vivo entre tenants (un tenant nunca debe cotizar en producción con la tasa negociada de otro — cada broker tiene su propio acuerdo comercial con la aseguradora); lo que se comparte es la **plantilla**, que el tenant nuevo clona a su propia tabla y confirma/ajusta antes de usarla.

```
rate_tables
  id
  organization_id       → dueño real de la fila (siempre tenant-scoped, sin excepción)
  visibility             'PRIVATE' (default) | 'TEMPLATE' — el PLATFORM_ADMIN marca cuáles de Delta son visibles como plantilla
  cloned_from_id          nullable, FK a otra rate_tables — trazabilidad de "de qué plantilla vino"
  is_confirmed            boolean, default false en las clonadas — bloquea su uso en cotizaciones reales hasta que el tenant la revisa
  ...
```

La política RLS necesita la excepción explícita, no un simple `organization_id = tenant`:

```sql
CREATE POLICY tenant_isolation_with_templates ON rate_tables
  USING (
    organization_id = current_setting('app.current_org_id')::uuid
    OR visibility = 'TEMPLATE'          -- lectura entre tenants, solo para plantillas
  )
  WITH CHECK (organization_id = current_setting('app.current_org_id')::uuid);  -- escribir sigue 100% aislado
```

`WITH CHECK` es la parte que importa: un tenant puede **leer** una plantilla de otro (para clonarla), pero jamás puede **escribir** fuera de su propio `organization_id` — el `USING` relaja la lectura, el `WITH CHECK` no relaja nada en la escritura. `rate_rules`/`deductible_rules` heredan la visibilidad de su `rate_table` padre en vez de duplicar el campo.

### RBAC con tenant

Se agrega un rol por encima de los que ya existían (`ADMIN`/`SUPERVISOR`/`AGENTE`/`LECTOR`, que ahora quedan **dentro** de una organización):

| Rol | Alcance |
|---|---|
| `PLATFORM_ADMIN` | Tu equipo. Cross-tenant: crea/gestiona brokers, ve todos los `organization_integrations`, administra el catálogo compartido de aseguradoras |
| `ADMIN` (por tenant) | Todo dentro de **su** organización |
| `SUPERVISOR` / `AGENTE` / `LECTOR` | Igual que en §8.4, pero ya implícitamente acotado a una organización |

### Costo de hacerlo ahora vs. después

Diseñar `organization_id` + RLS desde Fase 1 agrega trabajo real (no es gratis), pero es una fracción de lo que costaría retrofitarlo cuando ya haya datos reales de Delta en producción y un segundo broker esperando. Lo incorporo al alcance de Fase 1 sin tocar el resto del plan — si quieres que recalcule el número, lo hago, pero no es la prioridad de esta conversación.

---

## 2. Principios de código (obligatorios)

- **DDD** — La lógica de negocio vive en `src/domains/<dominio>/`, nunca en componentes. Los componentes delegan.
- **Clean Architecture** — Componentes = presentación. Servicios = negocio + acceso a datos. La dirección de dependencia siempre apunta hacia adentro: `app/ → domains/services → domains/repositories → db`. El dominio **no importa** nada de `app/` ni de React.
- **DRY** — Sin duplicación. **Sin métodos wrapper** (`getClientById` que solo llama a `repo.findById` no existe: se llama al repo). Soluciones genéricas parametrizadas.
- **Responsabilidad única** — Un propósito por clase/método.

### Traducción del principio "public readonly" a React

> El principio original (`servicios public readonly para acceso directo desde el template`) viene de Angular con DI. **Equivalente aquí:** los Server Components invocan las funciones del servicio de dominio directamente, sin capa intermedia de "controlador" ni wrappers de API.

```tsx
// ✅ Server Component llama al servicio directamente. Sin wrapper, sin fetch interno.
import { quoteService } from "@/domains/quoting/services/quote.service";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await quoteService.getComparison(id); // acceso directo
  return <ComparisonTable data={quote} />;
}
```

```tsx
// ❌ Prohibido: componente con lógica de negocio
export default async function QuotePage() {
  const rows = await db.select().from(quotes);           // acceso a datos en componente
  const prima = rows[0].neta * 1.035 * 1.005 * 1.15;     // regla de negocio en componente
}
```

**Regla dura:** si aparece un cálculo de prima, impuesto o comparación fuera de `src/domains/`, es un bug de arquitectura.

---

## 3. Estructura de carpetas

```
delta-check/
├─ src/
│  ├─ app/                                  # SOLO routing + presentación
│  │  ├─ (auth)/
│  │  │  ├─ login/page.tsx
│  │  │  └─ consent/page.tsx                # aceptación de políticas (§8)
│  │  ├─ (dashboard)/
│  │  │  ├─ layout.tsx                      # shell + guard de sesión
│  │  │  ├─ page.tsx                        # resumen / KPIs
│  │  │  ├─ cotizar/
│  │  │  │  ├─ autos/
│  │  │  │  │  ├─ page.tsx                  # paso 1: datos
│  │  │  │  │  └─ [quoteId]/comparar/page.tsx
│  │  │  │  └─ salud/…
│  │  │  ├─ cartera/                        # emisiones, pendientes, canceladas
│  │  │  ├─ comisiones/
│  │  │  ├─ siniestros/
│  │  │  └─ admin/                          # solo ADMIN: usuarios, tasas, aseguradoras
│  │  ├─ api/
│  │  │  ├─ auth/[...nextauth]/route.ts
│  │  │  └─ webhooks/insurers/[slug]/route.ts   # Fase 4
│  │  └─ layout.tsx
│  │
│  ├─ domains/                              # ⬅ TODA la lógica de negocio
│  │  ├─ shared/
│  │  │  ├─ money.ts                        # dinero en centavos (bigint). Nunca float.
│  │  │  ├─ result.ts                       # Result<T,E>, sin excepciones para flujo esperado
│  │  │  └─ audit.ts
│  │  ├─ identity/                          # usuarios, roles, permisos
│  │  │  ├─ services/rbac.service.ts
│  │  │  └─ repositories/user.repository.ts
│  │  ├─ clients/                           # cliente, vehículo, grupo familiar
│  │  ├─ catalog/                           # aseguradoras, coberturas, tasas
│  │  │  ├─ services/rate.service.ts
│  │  │  └─ repositories/rate.repository.ts
│  │  ├─ quoting/                           # ⬅ núcleo
│  │  │  ├─ services/
│  │  │  │  ├─ quote.service.ts             # orquesta la cotización
│  │  │  │  ├─ premium.calculator.ts        # prima neta → impuestos → total
│  │  │  │  └─ comparison.service.ts        # ranking / mejor opción
│  │  │  ├─ gateways/                       # puerto + adaptadores (§5)
│  │  │  │  ├─ insurer.gateway.ts           # interfaz
│  │  │  │  ├─ manual.adapter.ts            # Fase 1
│  │  │  │  └─ api/                         # Fase 4: aig.adapter.ts, zurich.adapter.ts…
│  │  │  └─ schemas/quote.schema.ts         # Zod, compartido cliente/servidor
│  │  ├─ policies/                          # emisión, cartera, cancelaciones
│  │  ├─ commissions/
│  │  └─ claims/                            # siniestros
│  │
│  ├─ components/                           # presentación pura, sin lógica de negocio
│  │  ├─ ui/                                # shadcn
│  │  └─ quoting/ComparisonTable.tsx
│  ├─ actions/                              # Server Actions: validan (Zod) → llaman servicio → revalidan
│  ├─ db/
│  │  ├─ schema/                            # Drizzle: un archivo por agregado
│  │  ├─ migrations/
│  │  └─ index.ts
│  └─ lib/
│     ├─ auth.ts                            # Auth.js config
│     ├─ rate-limit.ts
│     └─ env.ts                             # Zod sobre process.env; falla al build si falta algo
├─ e2e/
└─ drizzle.config.ts
```

---

## 4. Esquema lógico de base de datos

Convenciones: `snake_case`; PK `id uuid default gen_random_uuid()`; `created_at/updated_at timestamptz`; **dinero en `bigint` (centavos USD)**, jamás `float`; borrado lógico con `deleted_at` en entidades de negocio.

### 4.1 Diagrama de relaciones

```mermaid
erDiagram
    organizations ||--o{ users : emplea
    organizations ||--o{ clients : posee_cartera
    organizations ||--o{ rate_tables : negocia
    organizations ||--o{ organization_integrations : configura
    users ||--o{ user_roles : tiene
    roles ||--o{ user_roles : asignado
    roles ||--o{ role_permissions : concede
    users ||--o{ quotes : crea
    clients ||--o{ vehicles : posee
    clients ||--o{ insured_groups : titular_de
    insured_groups ||--o{ insured_members : incluye
    clients ||--o{ quotes : solicita
    quotes ||--o{ quote_risks : contiene
    quote_risks ||--o{ quote_options : cotiza
    insurers ||--o{ quote_options : ofrece
    insurers ||--o{ insurer_coverages : define
    coverages ||--o{ insurer_coverages : parametriza
    quote_options ||--o{ quote_option_coverages : detalla
    quote_options ||--o{ payment_options : financia
    quote_options ||--o| policies : se_emite
    policies ||--o{ policy_events : historial
    policies ||--o{ commissions : genera
    policies ||--o{ claims : registra
    users ||--o{ audit_logs : ejecuta
    users ||--o{ consents : acepta
```

### 4.2 Tablas

> **Multi-tenencia (§1b):** toda tabla marcada 🏢 lleva `organization_id → organizations` y política RLS. Las marcadas 🌐 son catálogo compartido entre todos los tenants.

**Organización (tenant)**

| Tabla | Campos clave |
|---|---|
| `organizations` 🌐 | `id`, `name`, `slug` (subdominio), `logo_url`, `brand_primary_color`, `brand_secondary_color`, `plan`, `is_active`, `created_at` |
| `organization_integrations` 🏢 | `id`, `organization_id`, `provider` (`SOFTSEGUROS`…), `enabled`, `credentials` (jsonb cifrado), `config` (jsonb) — ver §5b.3 |

**Identidad y RBAC**

| Tabla | Campos clave |
|---|---|
| `users` 🏢 | `id`, `organization_id` (nulo solo para `PLATFORM_ADMIN`), `email` (unique, citext), `full_name`, `provider` (`microsoft`\|`google`\|`email`), `provider_account_id`, `is_active`, `last_login_at` |
| `roles` 🌐 | `id`, `code` (`PLATFORM_ADMIN`\|`ADMIN`\|`SUPERVISOR`\|`AGENTE`\|`LECTOR`), `name` — catálogo fijo, no por tenant |
| `permissions` 🌐 | `id`, `code` (ej. `quote:create`, `rate:edit`, `commission:read_all`) |
| `role_permissions` 🌐 | `role_id`, `permission_id` (PK compuesta) |
| `user_roles` 🏢 | `user_id`, `role_id` (PK compuesta) |

**Clientes y objetos asegurados** (🏢 todas)

| Tabla | Campos clave |
|---|---|
| `clients` | `id`, `person_type` (`NATURAL`\|`JURIDICA`), `document_type` (`CEDULA`\|`RUC`\|`PASAPORTE`), `document_number` (unique + índice), `first_name`, `last_name`, `business_name`, `email`, `phone`, `source` (FUENTE del Excel), `assigned_agent_id → users`, `is_anonymized`, `anonymized_at`, `marketing_opt_out` (ARCO, §14) |
| `vehicles` | `id`, `client_id`, `plate`, `brand`, `model`, `year`, `body_type`, `color`, `chassis`, `commercial_value_cents`, `extras_value_cents`, `has_tracker` (afecta deducible de robo), `city` |
| `insured_groups` | `id`, `client_id`, `region` (`SIERRA`\|`COSTA`) — grupo de salud |
| `insured_members` | `id`, `group_id`, `relation` (`TITULAR`\|`DEPENDIENTE`), `age`, `gender`, `birth_date` |

**Catálogo de aseguradoras y tasas** (🌐 `insurers`/`coverages` compartidos · 🏢 el resto — tasas y comisiones negociadas, ver pregunta abierta en §1b)

| Tabla | Campos clave |
|---|---|
| `insurers` 🌐 | `id`, `code` (`AIG`,`SESA`,`GENERALI`,`ZURICH`,`SWEADEN`,`ATLANTIDA`,`ALIANZA`,`CONSTITUCION`,`UNIDOS`,`LATINA`,`ASEGSUR`,`CHUBB`,`CONDOR`,`BMI`,`HUMANA`,`SALUDSA`,`CONFIAMED`,`BUPA`…), `name`, `branch` (`AUTOS`\|`SALUD`), `logo_url`, `is_active`, `integration_mode` (`MANUAL`\|`API`) |
| `coverages` 🌐 | `id`, `code` (`RC`,`AP`,`GM`,`AUTO_SUSTITUTO`,`AMPARO_PATRIMONIAL`…), `name`, `branch`, `value_type` (`BOOLEAN`\|`AMOUNT`\|`TEXT`), `display_order` |
| `insurer_coverages` | `insurer_id`, `coverage_id`, `granted` (bool), `amount_cents`, `text_value`, `valid_from`, `valid_to` — **versionado por vigencia, nunca UPDATE destructivo** |
| `rate_tables` | `id`, `organization_id`, `insurer_id`, `branch`, `visibility` (`PRIVATE`\|`TEMPLATE`), `cloned_from_id`, `is_confirmed`, `valid_from`, `valid_to`, `created_by` — ver §1b para el modo plantilla |
| `rate_rules` | `id`, `rate_table_id`, `vehicle_age_min/max`, `value_min_cents`, `value_max_cents`, `body_type`, `usage_type`, `rate_percent` (`numeric(7,5)`), `min_premium_cents`, `emission_fee_cents` |
| `deductible_rules` | `id`, `insurer_id`, `kind` (`PARCIAL`\|`TOTAL_DANO`\|`TOTAL_ROBO`), `percent_of_loss`, `percent_of_insured_value`, `min_amount_cents`, `requires_tracker`, `text_label` |

**Cotización** (🏢 todas)

| Tabla | Campos clave |
|---|---|
| `quotes` | `id`, `code` (correlativo visible, ej. `COT-2026-00184`), `client_id`, `agent_id`, `branch`, `operation_type` (`NUEVA`\|`RENOVACION`), `status` (`BORRADOR`\|`ENVIADA`\|`ACEPTADA`\|`VENCIDA`), `previous_insurer_id`, `previous_policy_number`, `previous_expiry_date`, `valid_until`, `created_at` |
| `quote_risks` | `id`, `quote_id`, `risk_number` (1–4), `vehicle_id`, `insured_group_id`, `insured_value_cents`, `extras_value_cents` — soporta los "RIESGO 1..4" del Excel |
| `quote_options` | `id`, `quote_risk_id`, `insurer_id`, `modality` (`ANUAL`\|`POR_KM`), `net_premium_cents`, `super_bancos_cents` (3.50%), `campesino_cents` (0.50%), `emission_fee_cents`, `iva_cents` (15%), `total_premium_cents`, `rate_percent_applied`, `source` (`MANUAL`\|`API`), `raw_response` (jsonb, respuesta cruda de API), `quoted_at`, `is_recommended` |
| `quote_option_coverages` | `quote_option_id`, `coverage_id`, `granted`, `amount_cents`, `text_value` — **snapshot inmutable** de lo cotizado |
| `payment_options` | `id`, `quote_option_id`, `method` (`CONTADO`\|`TARJETA`), `installments` (6\|9\|12), `has_interest`, `installment_amount_cents` |

> **Regla clave:** `quote_option_coverages` guarda copia de las condiciones al momento de cotizar. Si la aseguradora cambia su cobertura mañana, la cotización enviada al cliente sigue siendo reproducible tal cual se emitió.

**Cartera, comisiones y siniestros** (🏢 todas — columnas confirmadas en las hojas `BASE EMISIONES`/`BASE PENDIENTE`/`BASE COMISIONES`/`BASE CANCELADAS`/`BASE SINIESTROS` del Excel; los *valores* de los enums de estado son diseño de Delta Check, no un vocabulario fijo del Excel — ver nota en `src/db/schema/enums.ts` y EXCEL-AUDIT.md §4)

| Tabla | Campos clave |
|---|---|
| `policies` | `id`, `quote_option_id`, `policy_number`, `insurer_id`, `client_id`, `branch`, `issue_status` (`PENDIENTE`\|`EMITIDA`\|`NO_EMITIDA`), `payment_status` (`PENDIENTE`\|`PAGADO`), `lifecycle_status` (`VIGENTE`\|`CANCELADA`), `inspection_required`, `starts_at`, `ends_at`, `premium_cents`, `invoice_number` (FACTURA), `annex_number` (ANEXO), `cancelled_at`, `cancellation_reason`, `notes` |
| `policy_installments` | `id`, `policy_id`, `installment_number` (1..N), `due_date`, `amount_cents`, `is_paid`, `paid_at` — una fila por cuota en vez de las 12 columnas fijas 1-12 de `BASE PENDIENTE` |
| `policy_events` | `id`, `policy_id`, `event_type`, `from_status`, `to_status`, `notes`, `user_id`, `created_at` — historial append-only |
| `commissions` | `id`, `policy_id`, `insurer_id`, `agent_id`, `base_amount_cents`, `percent`, `amount_cents`, `status` (`PENDIENTE`\|`COMISIONADA`), `paid_at`, `notes` — creada automáticamente al emitir una póliza (confirmado: la macro `ALTA_EN_BASE_PENDIENTE` escribe en `BASE_PENDIENTE` **y** en `BASE_COMISIONES` en el mismo paso) |
| `claims` | `id`, `policy_id`, `claim_number`, `status` (`REPORTADO`\|`APROBADO`\|`REPARADO`), `occurred_at`, `reported_at`, `description`, `deductible_applied_cents`, `workshop` (TALLER), `advisor_name` (ASESOR), `contact_phone` (CONTACTO), `has_third_party_liability` (RC — única lista de validación SI/NO real de esa hoja), `third_party_plate` (PLACA RC), `claim_value_cents` (VALOR), `third_party_value_cents` (VALOR RC), `notes` |

**Cumplimiento y auditoría** (🏢 todas — §8)

| Tabla | Campos clave |
|---|---|
| `consents` | `id`, `user_id`, `client_id`, `policy_version`, `terms_version`, `accepted_at`, `ip_address` (inet), `user_agent` |
| `audit_logs` | `id`, `user_id`, `action`, `entity_type`, `entity_id`, `ip_address` (inet), `user_agent`, `metadata` (jsonb), `created_at` — **append-only, sin UPDATE/DELETE** |
| `arco_requests` | `id`, `client_id`, `type` (`ACCESO`\|`RECTIFICACION`\|`CANCELACION`\|`OPOSICION`), `status` (`RECIBIDA`\|`EN_PROCESO`\|`COMPLETADA`\|`RECHAZADA`), `channel`, `notes`, `requested_by_user_id`, `requested_at`, `resolved_by_user_id`, `resolved_at`, `resolution_notes` — derechos ARCO, §14 |

### 4.3 Índices mínimos

```sql
CREATE INDEX idx_quotes_agent_created   ON quotes (agent_id, created_at DESC);
CREATE INDEX idx_quotes_client          ON quotes (client_id);
CREATE INDEX idx_quote_options_risk     ON quote_options (quote_risk_id, total_premium_cents);
CREATE INDEX idx_policies_renewal       ON policies (ends_at) WHERE lifecycle_status = 'VIGENTE';
CREATE INDEX idx_clients_document       ON clients (document_number);
CREATE INDEX idx_audit_entity           ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_rate_rules_lookup      ON rate_rules (rate_table_id, vehicle_age_min, vehicle_age_max);
```

---

## 5. Puerto de aseguradoras (clave para Fase 4)

```ts
// src/domains/quoting/gateways/insurer.gateway.ts
import type { RiskInput, InsurerQuote } from "../schemas/quote.schema";

export interface InsurerGateway {
  readonly insurerCode: string;
  readonly mode: "MANUAL" | "API";
  quote(risk: RiskInput): Promise<InsurerQuote>;
}
```

```ts
// src/domains/quoting/gateways/manual.adapter.ts — Fase 1
export class ManualRateAdapter implements InsurerGateway {
  readonly mode = "MANUAL" as const;
  constructor(
    readonly insurerCode: string,
    private readonly rates: RateRepository,
    private readonly calculator: PremiumCalculator,
  ) {}

  async quote(risk: RiskInput): Promise<InsurerQuote> {
    const rule = await this.rates.findApplicableRule(this.insurerCode, risk);
    if (!rule) return { insurerCode: this.insurerCode, status: "NO_COTIZA" };
    return this.calculator.build(this.insurerCode, risk, rule);
  }
}
```

En Fase 4 se agrega `AigApiAdapter implements InsurerGateway` y se registra en el resolver. `quote.service.ts` no se modifica: sigue haciendo `Promise.allSettled` sobre los gateways activos. Una aseguradora caída no rompe la comparación — devuelve `NO_COTIZA` y las demás siguen.

---

## 5b. Integración con SoftSeguros (sistema de gestión interno de Delta)

Delta ya opera **SoftSeguros** (`app.softseguros.com`) para pólizas, pagos, renovaciones y notificaciones. Revisé su documentación pública (`/docs/auth`, `/docs/poliza`, `/docs/cliente`) — es una API REST real, no un sistema cerrado, y esto **cambia una decisión de diseño de Fase 3** que conviene resolver ahora aunque la integración se construya después.

### 5b.1 Qué expone la API

| Recurso | Endpoints relevantes | Contenido |
|---|---|---|
| Auth | `POST /api-token-auth/` | Basic Auth o Token (`Authorization: Token …`), sin OAuth2/JWT |
| Clientes | `POST/GET /api/cliente/`, `GET /api/cliente/listar_cliente_por_documento/` | Persona natural o jurídica. `tipo_documento` incluye `ruc`, `cedula`, `pasaporte` — compatible con Ecuador |
| Pólizas | `POST/PUT/GET /api/poliza/`, `GET /api/estadopoliza/` | Alta y estado de póliza, prima, IVA, comisión, vigencia |
| Pagos | `POST /api/poliza/{id}/crear_pagos_multiples/`, `POST /api/pagopoliza/{id}/comisionar/` | Cronograma de pagos y comisión por pago |
| Siniestros | `POST/GET /api/siniestro/`, `/api/amparoafectado/` | Alta y seguimiento de siniestro |
| Aseguradoras / ramos | `/api/aseguradora/`, `/api/ramomarca/`, `/api/ramo/` | Catálogo propio de aseguradoras y líneas de negocio |

⚠️ **Ojo con los impuestos:** el ejemplo de su propia documentación trae `porcentaje_iva_prima: 19.0` — es el IVA de Colombia (SoftSeguros es una plataforma regional). **Nunca debe calcular impuestos por nosotros** — Delta Check calcula IVA 15% / SB 3.5% / SC 0.5% de Ecuador (§6) y solo *envía* el resultado ya calculado a los campos `prima`, `iva`, `total` de SoftSeguros.

### 5b.2 La decisión de diseño

SoftSeguros ya hace, en producción, buena parte de lo que había diseñado para la **Fase 3** desde cero: seguimiento de pólizas emitidas, pagos, comisiones y siniestros. Construir eso otra vez en Delta Check sería trabajo duplicado y, peor, dos sistemas de verdad divergentes (¿cuál manda si Delta Check y SoftSeguros no coinciden?).

**Mi recomendación:** Delta Check es la fuente de verdad **solo del proceso de cotización** (todo lo que pasa antes de que exista una póliza: `quotes`, `quote_risks`, `quote_options`). En el momento en que el cliente acepta una oferta y se emite, Delta Check **empuja** esa póliza a SoftSeguros (`POST /api/poliza/` + `crear_pagos_multiples`) vía el mismo patrón de puerto/adaptador que `InsurerGateway`:

```ts
// src/domains/policies/gateways/policy-management.gateway.ts
export interface PolicyManagementGateway {
  createPolicy(input: NewPolicyInput): Promise<{ externalId: string }>;
  createPaymentSchedule(externalId: string, plan: PaymentPlan): Promise<void>;
  getPolicyStatus(externalId: string): Promise<PolicyStatus>;
}
// Fase de integración: SoftSegurosAdapter implements PolicyManagementGateway
```

Con esto, **Fase 3 deja de ser "construir back-office desde cero"** y pasa a ser mucho más liviana: las tablas `policies`/`commissions`/`claims` de `ARCHITECTURE.md` §4.2 quedan como **cache local de solo lectura** (para que los dashboards de Delta Check no dependan de la latencia/disponibilidad de SoftSeguros), sincronizada desde SoftSeguros — no como el sistema donde se gestionan directamente. Eso reduce trabajo (no hay que construir seguimiento de pagos/notificaciones/renovaciones desde cero, ya existe) y evita el problema de "dos verdades".

**Necesito que confirmes:** ¿estás de acuerdo con que SoftSeguros sea el sistema de registro para pólizas/pagos/comisiones/siniestros una vez emitidos, y Delta Check se enfoque en cotizar + comparar + empujar la emisión? Si en cambio quieres que Delta Check lleve su propio control independiente (por ejemplo, porque van a dejar SoftSeguros a futuro), el diseño de §4.2 se queda como está y la integración es una sincronización de dos vías, no una de una sola. Cambia cómo diseño Fase 3.

### 5b.3 Que quede opcional para futuros tenants — así se resuelve

Confirmaste que Delta Check se integra con SoftSeguros **para el trabajo de Delta**, pero que un broker futuro que la arriende no debe tener eso como requisito ni bloqueo. El patrón de puerto/adaptador de §5b.2 ya resuelve esto de forma natural — solo falta que la *decisión de qué adaptador usar* se resuelva por tenant, no de forma global:

```
organization_integrations
  id
  organization_id      → FK a organizations
  provider              'SOFTSEGUROS' | (futuro: otro sistema de gestión)
  enabled                boolean
  credentials            jsonb, cifrado a nivel de columna (nunca texto plano)
  config                 jsonb — mapeos específicos del tenant (ids de ramo, sede, vendedor en SoftSeguros)
```

En tiempo de ejecución, el resolver de `PolicyManagementGateway` busca si la organización tiene una fila `enabled=true` en `organization_integrations`. Si la tiene, usa `SoftSegurosAdapter`. **Si no la tiene —porque es un broker nuevo que todavía no usa SoftSeguros, o simplemente no quiere—, usa un `NullPolicyGateway`**: la emisión se guarda en Delta Check normalmente y no se empuja a ningún lado. Nada del flujo de cotización, comparación o generación de carátula depende de si esta integración existe. Eso es exactamente "que no sea impedimento tenerlo deshabilitado": es un `if` en un resolver, no una ramificación del producto.

### 5b.4 Histórico — se trae de SoftSeguros, no del Excel

Se descarta migrar el Excel (confirmado — `BASE VEHICULOS`, `EMISIONES`, `PENDIENTE`, `COMISIONES`, `CANCELADAS`, `SINIESTROS` están vacías de todos modos, ver `EXCEL-AUDIT.md`). El histórico real de Delta — pólizas activas, no renovadas, canceladas y creadas por error — vive en SoftSeguros, y ya lo cubre el mismo puerto: se le agrega el lado de **lectura**.

```ts
export interface PolicyManagementGateway {
  createPolicy(input: NewPolicyInput): Promise<{ externalId: string }>;
  createPaymentSchedule(externalId: string, plan: PaymentPlan): Promise<void>;
  getPolicyStatus(externalId: string): Promise<PolicyStatus>;
  listPolicies(filter: { since?: Date; page: number }): Promise<PagedResult<ExternalPolicy>>; // ← backfill histórico
}
```

`SoftSegurosAdapter.listPolicies` pagina `GET /api/poliza/` (su propia documentación dice máximo 10 registros por página) y cruza cada póliza contra `GET /api/estadopoliza/` para mapear su estado real. Esto reemplaza por completo la Fase 6 que había planteado como "migración de Excel con validación punto a punto" — ya no aplica, era la solución al problema equivocado.

**Lo que sigue pendiente para poder construir esto** (no para diseñarlo, ya está diseñado): credenciales de API de SoftSeguros, y el resultado real de `GET /api/estadopoliza/` en la cuenta de Delta — ahí van a aparecer los nombres exactos que usan para "vigente", "no renovada", "cancelada" y "creada por error" (es un catálogo propio de cada cuenta, no un enum fijo de SoftSeguros), y con eso mapeo cada uno a `policies.lifecycle_status`/`issue_status` sin adivinar. Las pólizas "creadas por error" probablemente se importan pero se excluyen de los dashboards por defecto — lo dejo como bandera (`is_void` o similar) en vez de borrarlas, para no perder el registro.

---

## 6. Código base — vista principal (comparador)

**Cálculo de prima** (impuestos ecuatorianos, tomados del Excel):

```ts
// src/domains/quoting/services/premium.calculator.ts
const SUPER_BANCOS = 0.035;  // 3.50%
const SEGURO_CAMPESINO = 0.005; // 0.50%
const IVA = 0.15;            // 15%

export function buildPremium(netCents: bigint, emissionFeeCents: bigint) {
  const superBancos = mulRate(netCents, SUPER_BANCOS);
  const campesino   = mulRate(netCents, SEGURO_CAMPESINO);
  const taxableBase = netCents + superBancos + campesino + emissionFeeCents;
  const iva         = mulRate(taxableBase, IVA);
  return {
    netCents,
    superBancosCents: superBancos,
    campesinoCents: campesino,
    emissionFeeCents,
    ivaCents: iva,
    totalCents: taxableBase + iva,
  };
}
```

**Página del comparador** (Server Component, sin lógica de negocio):

```tsx
// src/app/(dashboard)/cotizar/autos/[quoteId]/comparar/page.tsx
import { notFound } from "next/navigation";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { comparisonService } from "@/domains/quoting/services/comparison.service";
import { ComparisonTable } from "@/components/quoting/ComparisonTable";

export default async function CompararPage({
  params,
}: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const session = await requirePermission("quote:read");

  const comparison = await comparisonService.getForQuote(quoteId, session.user.id);
  if (!comparison) notFound();

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Comparativa — {comparison.clientName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {comparison.vehicleLabel} · {comparison.options.length} aseguradoras cotizadas
        </p>
      </header>
      <ComparisonTable comparison={comparison} />
    </section>
  );
}
```

**Server Action** (validar → servicio → revalidar → auditar):

```ts
// src/actions/quote.actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { quoteInputSchema } from "@/domains/quoting/schemas/quote.schema";
import { quoteService } from "@/domains/quoting/services/quote.service";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/domains/shared/audit";

export async function createQuote(formData: FormData) {
  const session = await requirePermission("quote:create");
  await rateLimit(`quote:${session.user.id}`, { limit: 30, window: "1m" });

  const parsed = quoteInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten() };

  const quote = await quoteService.create(parsed.data, session.user.id);
  await audit("quote.created", { entityId: quote.id, userId: session.user.id });

  revalidatePath("/cotizar/autos");
  return { ok: true, quoteId: quote.id };
}
```

---

## 7. Identidad visual

Colores extraídos del sitio real (`deltaseguros.com.ec`), ya aplicados en el MVP visual — **re-verificados en vivo** (no de memoria) contra `deltaseguros.com.ec` navegando el sitio y leyendo `getComputedStyle()` de sus propios elementos (botón "COTIZAR"/"COTIZA AHORA", header, texto): los 4 valores son un match exacto, pixel a pixel, sin necesidad de ajustar nada:

```css
--delta-navy: #152a52;   /* institucional — header, fondo del botón "COTIZAR" del sitio real */
--delta-navy-2: #1b325f;
--delta-blue: #01579e;   /* acento / CTA — botón "COTIZA AHORA" del sitio real */
--delta-gray: #797c7f;   /* color de texto secundario del sitio real */
```

Logo: `Delta_Logocolor.png` (fondo claro) / `Delta_Logoblanco.png` (fondo oscuro) — nombres de archivo confirmados contra los `<img src>` reales del sitio (`Delta_Logocolor.png` / `Delta_Logoblanco_blanco.png`).

**Modo oscuro/claro** — ver §20 para el toggle; los tokens de fondo/texto/superficie de cada modo (`--background`, `--foreground`, `--surface`, `--border`, `--muted`) son diseño propio de Delta Check, no extraídos de ningún lado: el sitio de marketing de Delta Seguros es solo claro, sin variante oscura que copiar.

---

## 8. Seguridad

### 8.1 Frontend
- **HTTPS + TLS 1.3** — forzado en el proveedor (Vercel lo entrega por defecto); HSTS `max-age=63072000; includeSubDomains; preload`.
- **CSP estricta** por middleware, con nonce por request:
  ```
  default-src 'self'; script-src 'self' 'nonce-{N}' https://www.google.com/recaptcha/;
  style-src 'self' 'nonce-{N}'; img-src 'self' data: https:; frame-ancestors 'none';
  object-src 'none'; base-uri 'self'
  ```
- Headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictiva.
- **reCAPTCHA v3** en login por email y en el formulario de cotización; se valida el score **en el servidor** (umbral 0.5), nunca en cliente.
- **Ofuscación:** minificación + `productionBrowserSourceMaps: false`.
  > ⚠️ La ofuscación de JS no es un control de seguridad real — cualquier lógica sensible debe vivir en el servidor. Se incluye porque lo pediste, pero no sustituye a §8.2.

### 8.2 Backend / APIs
- **OAuth2/OIDC** vía Microsoft Entra ID y Google. Sesión en cookie `httpOnly`, `Secure`, `SameSite=Lax`, rotación en cada login. JWT solo para el canal servidor↔servidor de Fase 4 (credenciales de aseguradoras en un secret manager, nunca en la BD).
- **Rate limiting** (Redis, sliding window): login 5/min/IP · cotización 30/min/usuario · APIs de aseguradoras según el cupo de cada una.
- **Validación en servidor:** todo input pasa por Zod dentro de la Server Action **antes** de tocar el dominio. Drizzle usa consultas parametrizadas (sin SQL string). Sanitización de cualquier HTML con `isomorphic-dompurify`.
- Autorización por permiso en **cada** Server Action (`requirePermission`), nunca solo ocultando el botón en la UI.

### 8.3 Base de datos
- **Cifrado en reposo:** AES-256 a nivel de volumen (gestionado por el proveedor) + `pgcrypto` a nivel de columna para `document_number` y datos de contacto.
- **Enmascaramiento:** vistas `*_masked` (ej. cédula → `17****4001`) usadas por el rol `LECTOR`; el dato completo solo se expone con permiso `client:read_pii`.
- **Menor privilegio:** rol `app_rw` (CRUD, sin DDL) para la app · `app_ro` para reportes · `app_migrate` (DDL) solo en CI de migraciones. Ningún servicio usa el superusuario.
- **Nunca almacenar:** tarjetas de crédito ni contraseñas en texto plano. La forma de pago se guarda como *plan* (`CONTADO`/`TARJETA` + cuotas), **jamás el número de tarjeta**.

**⚠️ Hueco identificado, sin cerrar:** RLS con `FORCE` en `users` bloquea, por diseño, resolver "a qué `organization_id` pertenece este email" en el momento del login — todavía no hay tenant fijado para que la política deje pasar la fila. Hoy no se manifiesta porque el pool de conexión local corre como superusuario de Postgres (salta RLS por completo, verificado). En cuanto exista el rol `app_rw` de arriba, ese lookup se rompe tal como está. Solución pendiente de implementar: un rol de BD aparte y estrecho (`app_auth`, sin `FORCE RLS` o con una política de excepción explícita) usado *solo* por el callback de login de Auth.js para ese único lookup — nunca por el resto del código. No se construye todavía; queda documentado para no descubrirlo en producción.

### 8.4 Roles (RBAC)

| Rol | Alcance |
|---|---|
| `PLATFORM_ADMIN` | Cross-tenant (§1b) — tu equipo, no un usuario de ningún broker. Crea organizaciones, administra el catálogo compartido |
| `ADMIN` | Todo dentro de **su** organización: ABM de usuarios, tasas y aseguradoras propias |
| `SUPERVISOR` | Ve la cartera y comisiones de todos los agentes de su organización; no edita tasas |
| `AGENTE` | Cotiza, gestiona **sus** clientes y **sus** comisiones, dentro de su organización |
| `LECTOR` | Solo lectura, con PII enmascarada |

Los permisos se resuelven en BD (`role_permissions`), no hardcodeados: agregar un rol es un INSERT, no un deploy. La verificación de permiso (`requirePermission`) siempre valida rol **y** `organization_id` juntos — un `ADMIN` de un broker no puede actuar sobre datos de otro aunque adivine un ID.

---

## 9. Cumplimiento legal (Ecuador — LOPDP)

- **Consentimiento explícito:** checkbox **no premarcado** de Políticas de Privacidad y Términos de Uso. El botón **Cotizar** permanece deshabilitado hasta marcarlo. Se registra en `consents` con versión del documento, timestamp, IP y user-agent.
- **Trazabilidad:** cada acción crítica (cotizar, emitir, cancelar, exportar, ver PII) va a `audit_logs` con usuario, IP, hora, entidad y resultado. Tabla **append-only**: `REVOKE UPDATE, DELETE ON audit_logs FROM app_rw`.
- **Minimización:** solo se recolecta lo que la cotización requiere. Retención definida por política del broker (pendiente de confirmar con Delta — ver §11).
- **Derechos ARCO:** ✅ implementado — ver §14.

---

## 10. Fases

| Fase | Alcance | Estado |
|---|---|---|
| 0 | MVP visual | ✅ Entregado |
| 1 | Auth + RBAC + clientes/vehículos + comparador Autos (13 aseguradoras) + modalidad Auto x Km + carátula PDF | ✅ Completa — login con Microsoft construido (§19), falta que Delta genere las credenciales reales de Entra ID (§11.3); Google sigue sin construir |
| 2 | Módulo Salud (8 aseguradoras, titular + dependientes) | ✅ Completa — BMI, Humana, Confiamed, SaludSA, Pro, VB y Salud genérica con tarifa real (7/8); solo Bupa 100% manual, sin tabla en el Excel (§2.3 de `EXCEL-AUDIT.md`) |
| 3 | Cartera, comisiones, siniestros, KPIs, ARCO | ✅ Completa — cartera/comisiones/siniestros (emitir póliza desde una cotización cotizada, cuotas, comisión automática al emitir), dashboard de KPIs (§14) y derechos ARCO (§14) |
| 4 | Adaptadores API por aseguradora + integración SoftSeguros (push de emisión + backfill de histórico, §5b) | Pendiente |
| 5 | Despliegue, capacitación, entrega | Pendiente |

Presupuesto vigente en `README.md`.

---

## 11. Decisiones — resueltas y abiertas

Auditoría completa hecha sobre el archivo: las 198 macros VBA (`oletools`/`olevba`, cuerpo completo) y las fórmulas de las 30 hojas. Detalle exhaustivo, clasificación de macros y tablas de tarifas exportadas en **[`EXCEL-AUDIT.md`](./EXCEL-AUDIT.md)**. Resumen de lo accionable:

### 11.1 Tasas — ✅ resuelto, con matiz importante

**No están en las macros.** Las 198 subrutinas VBA son navegación (`HOME`, `DASHBOARD`), mostrar/ocultar variantes de plan (`BMI_MOSTRAR_OCULTAR_...`), alta en bases (`ALTA_EN_BASE_EMISIONES`) e impresión (`IMPRIMIR_OFERTA_VH`). **Ninguna calcula prima ni tasa.** El cálculo vive en fórmulas de hoja:

- **AIG, SESA, Generali, Zurich, Sweaden, Atlántida, Alianza, Constitución, Unidos, Asegsur, Chubb (11 de 13):** la celda de Prima Neta (`DATOS OFERTA!C31`, `D31`…) es un **valor literal `0`** — un input que el ejecutivo digita a mano por cotización. No hay tabla de tasas para estas 11 en el archivo.
- **Latina y Cóndor (2 de 13):** **sí tienen un motor de tasas real**, con fórmula `VLOOKUP` contra una tabla en `INFO GENERAL!AF7:AI25` — tasa por rango de valor asegurado × clase de vehículo (`LIVIANO`/`PICKUP`) × antigüedad (≤10 años tabla completa, 11–13 años tasa plana 3%, >13 "NO COTIZA"). Extraje esa tabla completa; la voy a sembrar directo en `rate_rules` en Fase 1 — son datos reales, no de ejemplo.

**Lo que necesito de ti:** para que Fase 1 cotice con cifras reales en las otras 11 aseguradoras, o me pasas la tabla de tasas de cada una (si existe en papel o en otro archivo), o el sistema arranca con esas 11 en modo "digitación manual por cotización" — exactamente como funciona hoy el Excel, solo que centralizado. No es un bloqueante: es la misma limitación que ya tienen, no una nueva.

**Auto x Km — verificado, mismo patrón.** `OFERTA KM!H37` deriva la prima neta a partir de `DATOS OFERTA X KM!E10`, que es un input manual (`0` literal) por cada uno de los 6 rangos de km. No hay tabla de tasas para esta modalidad tampoco. Consecuencia práctica: no hay que construir un motor de cálculo nuevo, solo una variante de formulario con 6 campos de precio (por rango de km) en vez de 1 campo anual — la estimación de +18h en §11.7 ya asumía esto y no cambia.

### 11.2 Comisiones — ✅ resuelto: sí, manual hasta Fase 4

En `BASE COMISIONES!O15` la columna es literalmente **"% COMISION"** como campo de texto/número que se llena a mano por póliza — no hay fórmula ni tabla por aseguradora en ningún lado del archivo. Confirmado: se guarda como **campo editable en `commissions.percent`**, sin valor por defecto, tal como ya trabajan hoy. Cuando se conecte una API de aseguradora en Fase 4, si esa API devuelve el % de comisión se autocompleta; si no, se sigue digitando a mano. Cero trabajo extra por esto.

### 11.3 Microsoft Entra ID — ✅ buenas noticias

Tener cuentas de **Exchange significa que ya tienen Microsoft 365**, y **todo tenant de M365 trae un tenant de Entra ID (Azure AD) incluido automáticamente** — no hay que comprar nada nuevo. Para confirmarlo y avanzar:

1. Alguien con rol de **Administrador global** o **Administrador de aplicaciones** entra a [entra.microsoft.com](https://entra.microsoft.com) con su cuenta corporativa.
2. Si entra, el tenant ya existe (va a ser el caso).
3. `Aplicaciones → Registros de aplicaciones → Nuevo registro`, agrega el redirect URI `https://<dominio-delta-check>/api/auth/callback/microsoft-entra-id`.
4. Me pasa `Tenant ID`, `Client ID` y genera un `Client Secret` — eso es todo lo que necesito para el login con Microsoft.

Si nadie en Delta tiene ese rol de administrador hoy, es cuestión de pedírselo a quien gestiona la suscripción de M365 (probablemente el mismo proveedor de correo/soporte IT).

El botón "Iniciar sesión con Microsoft" y el filtro de dominio ya están construidos del lado de Delta Check — ver §19. Lo único que falta para que funcione de verdad son esas 3 credenciales.

### 11.4 Auto x Km — ✅ resuelto: entra en Fase 1

Confirmado también en las macros: `AUTOXKM()`, `DATOS_CLIENTE_XKM()`, `ALTA_EN_BASE_VEHICULOS_XKM()`, `ACTUALIZAR_BASE_VEHICULOS_XKM()`, `OFERTA_XKM()`, `IMPRIMIR_OFERTA_XKM()` — es un flujo paralelo completo al de Autos anual, con sus propias hojas (`DATOS OFERTA X KM`, `OFERTA KM`). Reutiliza la mayor parte del dominio (`quote_risks`, `quote_options`, catálogo de coberturas), así que el costo incremental es menor que construirlo desde cero, pero **no es gratis**: sube el presupuesto de Fase 1 en ~18h. Ya está reflejado en la tabla de §11.7 y en `README.md`.

### 11.4b Salud (AM) — hallazgo mayor: sí hay motor de tarifas real

A diferencia de Autos, la línea Salud **no depende de digitación manual**. Existe una hoja oculta (`BASES ASEGURADORAS AM`, 238×152 celdas) con tablas de tarifa reales por edad × región × plan × deducible para Humana, BMI, SaludSA, Pro, Confiamed, VB y Salud genérica — las 7 ya sembradas con datos reales, rango de cada una confirmado por su propia fórmula VLOOKUP, no por posición/rótulo cercano (solo Bupa no tiene tabla, ver `EXCEL-AUDIT.md` §2.3). Está exportada completa en [`reference-data/salud_bases_aseguradoras_am_RAW.csv`](./reference-data/salud_bases_aseguradoras_am_RAW.csv). Cambia el diseño de `rate_rules` para Fase 2: no es "tramo × tasa fija" como en Autos, es una tabla multidimensional. Detalle completo en `EXCEL-AUDIT.md` §2.3.

### 11.4c SoftSeguros — parcialmente resuelto

✅ Confirmado: se integra para Delta, y **debe ser opcional/deshabilitable para futuros tenants sin bloquear el producto** — resuelto con el patrón `organization_integrations` + `NullPolicyGateway` en §5b.3, ya reflejado en el esquema de §4.2.

Sigue abierto: si SoftSeguros queda como sistema de registro de pólizas/pagos/comisiones/siniestros (mi recomendación, §5b.2) o si Delta Check lleva su propio control en paralelo. Y, cuando toque construirla: credenciales de API y si el plan de SoftSeguros que tiene Delta habilita acceso a la API (no todos los planes SaaS lo hacen).

### 11.4d Multi-tenencia — resuelto

Ver §1b. Ambas preguntas cerradas:
1. ✅ **Sí, las tasas/comisiones de Delta sirven de plantilla.** `rate_tables` tiene modo `TEMPLATE`: un tenant nuevo clona la plantilla a su propia tabla (`cloned_from_id`) y queda `is_confirmed = false` hasta que la revisa — nunca cotiza en producción con la tasa negociada de otro broker sin confirmarla primero como propia. RLS lo permite en lectura, nunca en escritura.
2. ✅ El campo de marca (`organizations.brand_primary_color`, `brand_secondary_color`, `logo_url`) queda en el esquema desde ya. **El motor de theming (aplicarlo de verdad en la UI y en la carátula PDF) no se construye todavía** — se activa cuando exista un segundo tenant real, no antes.

### 11.5 Retención de datos — abierto

Sigue pendiente: ¿cuántos años deben conservarse cotizaciones y pólizas según la política interna del broker (o la normativa de seguros de la Superintendencia)? Afecta si `audit_logs` y `policies` llevan borrado/archivado automático.

### 11.6 Migración histórica — ✅ resuelto: no se migra el Excel, se importa desde SoftSeguros

Confirmado con el contenido real (no solo el conteo de filas) de las 7 hojas `BASE *`: seis están completamente vacías (solo encabezados) y `BASE AM` tiene apenas 6 registros reales de salud (sep/2024–may/2025). El histórico real y completo de la empresa —pólizas activas, no renovadas, canceladas y creadas por error— vive en SoftSeguros, no en este archivo.

**Decisión:** se descarta migrar el Excel. El histórico se trae con `PolicyManagementGateway.listPolicies()` contra la API de SoftSeguros — mismo puerto que la integración de emisión, ver §5b.4. Deja de existir como "Fase 6" separada; es parte de la Fase 4.

### 11.7 Presupuesto actualizado

Con Auto x Km sumado a Fase 1 (el resto de fases no cambia):

| Fase | Horas | Precio |
|---|---|---|
| 1 — Plataforma base, Autos + Auto x Km | 94h | $1.128 |
| 2 — Salud | 30h | $365 |
| 3 — Back-office | 34h | $408 |
| 4 — API piloto (3 aseg.) + SoftSeguros (emisión + histórico, §5b) | 48h + *por definir* | $576 + *por definir* |
| 5 — Despliegue | 5h | $60 |

- **Base (1+3+5): $1.596**
- **Recomendado (1+2+3+5): $1.961**
- **Completo con piloto API (1–5): $2.537**

⚠️ No incluye todavía las horas de multi-tenencia (§1b) ni de la integración SoftSeguros (§5b) — se suman cuando se recalcule, ver nota en `README.md`.

---

## 12. Convenciones operativas

- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`). Rama por fase: `fase-1-autos`.
- **Migraciones:** `drizzle-kit generate` → revisar SQL a mano → commit. Nunca `push` directo a producción.
- **Sin datos reales de clientes en desarrollo.** Seeds sintéticos en `src/db/seed.ts`.
- **Definition of done por fase:** tests de dominio en verde · flujo E2E principal en verde · migración aplicada · `ARCHITECTURE.md` actualizado.

---

## 13. Autocompletar desde fuentes externas (cédula, placa, avalúo)

Como en otros cotizadores en línea de Ecuador, se investigó autocompletar datos desde el documento del cliente y desde la placa del vehículo, para reducir digitación. Antes de construir nada se investigó qué fuentes son realmente públicas y sin autenticación — no se construyó sobre un endpoint no documentado o protegido sin autorización explícita.

| Dato | Fuente investigada | Resultado |
|---|---|---|
| Nombre desde cédula | SRI — `srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/obtenerPorNumerosRuc` | ✅ **Implementado.** Pública, sin autenticación, confirmada en vivo (probada primero contra el RUC institucional del propio SRI antes de tocar cualquier dato personal). El RUC de persona natural es cédula + `"001"` — convención del propio SRI, no un truco. `razonSocial` de persona natural es el nombre legal completo, misma fuente que usaría el Registro Civil (que no tiene servicio público propio). |
| Datos del vehículo desde placa | ANT — portal de consulta vehicular | ❌ No implementado. Sin API pública documentada; el propio portal aclara que el nombre del propietario está protegido por LOPDP y no se muestra en la consulta pública. Construir esto requeriría scraping de un portal interactivo (con posible CAPTCHA) sin autorización — fuera de lo que se hace en este proyecto. |
| Avalúo comercial desde marca/modelo/año o placa | PatioTuerca (guía de precios), SRI avalúo vehicular | ❌ No implementado. PatioTuerca solo tiene un formulario web, sin API pública. El avalúo vehicular del SRI existe pero vive bajo `sri-en-linea` (requiere sesión del contribuyente autenticado), no es un endpoint público como el de RUC. |

**Diseño — puerto/adaptador, mismo patrón que `InsurerGateway` (§5):**

```
domains/lookup/
  gateways/
    cedula-lookup.gateway.ts        # interfaz — PersonLookupResult: FOUND | NOT_FOUND | ERROR
    sri-cedula-lookup.adapter.ts    # implementación real contra el SRI
  cedula.validator.ts               # módulo 10 — valida antes de gastar una llamada externa
  razon-social.parser.ts            # "APELLIDO1 APELLIDO2 NOMBRE1.." → {firstName, lastName}
```

`lookupPersonByCedula()` (`src/actions/lookup.actions.ts`) exige `client:read_pii` (es una consulta de identidad de un tercero) y se audita como `cedula.lookup` — mismo criterio que ver la cédula/nombre de un cliente (§9). Nunca bloquea el formulario: `NOT_FOUND` o `ERROR` (timeout, SRI caído) dejan los campos para digitación manual, igual que cualquier otro dato sin fuente real en este proyecto — nunca se inventa un nombre.

Botón "Buscar en SRI" junto al campo Documento en ambos formularios de nueva cotización (Autos y Salud) — ver `src/components/shared/CedulaLookupButton.tsx`.

> **Corrección (§20.1):** todas las notas de este documento que dicen "no se pudo confirmar por el problema de hidratación, atribuido a la herramienta de automatización" estaban mal diagnosticadas. La causa real era la CSP de `proxy.ts`, presente desde el primer commit del proyecto — bloqueaba en silencio los scripts inline que el propio Next.js necesita para hidratar, en **cualquier** navegador, no solo en la herramienta de automatización. Se corrigió (nonce por request) el 2026-09-13, encontrado por el usuario probando la demo en su Chrome real. Ver §20.1 para el detalle completo y qué se volvió a verificar después del fix.

**Nota de verificación (antes del fix de §20.1):** el pipeline completo (validación local, llamada real al SRI, parseo de nombre, permiso + auditoría contra la BD) se verificó con scripts directos y tests unitarios (`cedula.validator.test.ts`, `razon-social.parser.test.ts`). La interacción del botón en el navegador (clic → Server Action) no se pudo confirmar en esta sesión: el entorno de automoción del navegador usado para probar tuvo un problema de hidratación de React ajeno a este código (confirmado con `curl` que el HTML del servidor sí trae el script de arranque correcto de Next.js) que dejó inertes todos los botones `onClick` de la página, no solo este — mismo patrón, ya documentado antes en este proyecto, de que la automatización del navegador puede fallar sin que sea un bug de la app.

### 13.1 Investigación adicional — competencia y PatioTuerca

A pedido del usuario se investigaron en vivo (navegador real, no solo búsqueda web) 5 cotizadores de seguro de auto que operan en Ecuador — Zurich, AseguraDeUna, Sur One, Prodeseg y Seguros.com — para confirmar si alguno resuelve el autocompletado de datos del vehículo o el avalúo desde la placa. **Ninguno lo hace** — los 5 piden marca/modelo/año/placa/valor comercial como texto libre o selects estáticos, igual que Delta Check. Zurich (aseguradora grande, con presupuesto) tiene exactamente los mismos campos que ya construimos.

Al inspeccionar Prodeseg con las herramientas de red del navegador (no ingeniería inversa de nada oculto — son las mismas llamadas que dispara su propia página al cargar, sin autenticación) se confirmó que:
- Su catálogo de marcas (`/api/public/marcas`) es real, público, y sirvió de referencia para curar `vehicle_brands` (§15).
- **Prodeseg es quien opera el cotizador de seguros embebido en PatioTuerca** — su propio JSON de aseguradoras trae `landingsEnabled: ["PRODESEG","PATIOTUERCA"]`. Mismo backend, dos marcas al frente.
- Un intento de enviar el formulario (con autorización explícita del usuario, usando su propio correo) reveló que la validación de email de Prodeseg (`zero-bounce`, un servicio de terceros) está bloqueada por Cloudflare (`error code: 1020`) — no se intentó sortear ese bloqueo, es exactamente el tipo de protección que este proyecto no evade.

**PatioTuerca — corrección: sí hay un precio real, en una página distinta a la que se probó primero.** El widget interactivo "Nuevo avalúo" (el que pide tipo/marca/modelo/año en un solo formulario) se probó dos veces, en dos páginas distintas, y las dos veces mostró *"Este contenido no está disponible en este momento"* — eso sigue roto, confirmado dos veces. Pero es una feature *distinta* de la guía de precios estática: en `ecuador.patiotuerca.com/precio/autos/{marca}/{modelo}/{año}` (con año incluido en la URL) sí aparece un precio real — "Precio ideal / más bajo / más alto", calculado sobre datos de sus propias publicaciones, no un solo anuncio. Ver §16 para el detalle y por qué igual no se integra por API.

---

## 14. KPIs y derechos ARCO (cierre de Fase 3)

### 14.1 KPIs — dashboard

El Excel original **no tiene un tablero real que reproducir**: las hojas `DASHBOARD` y `BASE DASHBOARD` están completamente vacías (confirmado al auditar Fase 3, sin una sola celda con contenido, ni fórmula `COUNTIF`/`SUMIF` que sugiera qué métrica mostrar). Las métricas de `/dashboard` son diseño propio de Delta Check sobre los datos que el dominio ya genera, no algo extraído del archivo original:

- Cotizaciones (total, por estado, por ramo).
- Conversión a póliza (% de cotizaciones que llegaron a emitirse — una póliza cancelada sigue contando como "llegó a emitirse", la cancelación es un evento posterior).
- Cartera vigente (pólizas vigentes vs. canceladas, prima total vigente).
- Comisiones (pendientes vs. comisionadas).
- Siniestros (por estado, valor total).

`dashboardService.getSummary()` (`src/domains/dashboard/services/dashboard.service.ts`) hace 5 queries agregadas (`count`/`sum` + `groupBy`) contra `quotes`/`policies`/`commissions`/`claims`. Corren **secuenciales, no con `Promise.all`** — encontrado como bug real durante la verificación: `tx` es una transacción sobre una única conexión Postgres, y lanzar varias queries a la vez en la misma conexión es comportamiento deprecado del driver `pg` (avisa en consola hoy, dejará de funcionar en `pg@9`). `getDashboardSummary()` exige `quote:read_all` — mismo nivel que ver comisiones de todos los agentes, no de un agente individual.

### 14.2 Derechos ARCO — Acceso, Rectificación, Cancelación, Oposición

Sin equivalente en el Excel — esto no es un dato de negocio del cotizador, es cumplimiento legal (LOPDP Ecuador), diseño propio. `arco_requests` (`src/db/schema/compliance.ts`) registra cada solicitud: `type` (`ACCESO`\|`RECTIFICACION`\|`CANCELACION`\|`OPOSICION`), `status` (`RECIBIDA`\|`EN_PROCESO`\|`COMPLETADA`\|`RECHAZADA`), `channel` (texto libre — cómo llegó el pedido, sin vocabulario fijo, mismo criterio que `ESTATUS` en las hojas `BASE_*` de cartera, EXCEL-AUDIT.md §4), notas de resolución, quién la registró y quién la resolvió.

Separación real de responsabilidad, no cosmética: cualquier agente puede **registrar** el pedido que el cliente le hizo (`client:read_pii`, `/cumplimiento/nueva` — busca al cliente por documento, tiene que existir ya en el sistema), pero **procesarlo** (rectificar, anonimizar, fijar oposición, marcar la solicitud como resuelta) exige `compliance:manage` (SUPERVISOR/ADMIN).

- **Acceso** — `arcoService.exportClientData()` trae *todo* el dato crudo ligado al cliente (datos propios, vehículos, grupos/miembros de salud, cotizaciones, pólizas, siniestros, consentimientos), sin resumir ni transformar: el titular tiene derecho a ver el dato tal cual está guardado.
- **Rectificación** — corrige nombre/razón social/email/teléfono directamente sobre `clients`.
- **Cancelación** — **nunca borra la fila**. Pólizas, comisiones y siniestros ligados a un cliente exigen retención legal (obligación regulatoria/tributaria de un intermediario de seguros), y el propio LOPDP exceptúa el borrado cuando hay una obligación legal de conservar el dato. Lo que sí pasa siempre: se redacta el contacto (`email`/`phone` → `"[ANONIMIZADO]"`, no hace falta para administrar una póliza ya emitida). El **nombre** solo se redacta si el cliente **nunca tuvo una póliza** — si tuvo alguna (vigente o cancelada), el nombre queda como identificación legal del historial. `clients.isAnonymized`/`anonymizedAt` marcan el resultado. **Esto es un default de ingeniería razonable, no asesoría legal** — antes de operar con clientes reales, un abogado de Delta debería confirmar el criterio de retención exacto para intermediarios de seguros en Ecuador.
- **Oposición** — hoy la app no tiene ningún pipeline de marketing/comunicación automatizado que "detener"; `clients.marketingOptOut` deja el flag listo para cuando lo haya, con su propia solicitud ARCO auditada.

Todo cambio (rectificar, anonimizar, fijar oposición) audita en `audit_logs` (`arco.*`) y marca la solicitud como `COMPLETADA` automáticamente — coherente con §9 ("cada acción crítica... va a `audit_logs`").

**Verificación:** dominio completo (KPIs + los 4 tipos de ARCO, incluidos ambos casos de Cancelación — con y sin póliza) probado con un script directo contra Postgres real, con aserciones explícitas sobre cada resultado (incluida la corrección del bug de `Promise.all`). La interacción de UI no se pudo confirmar en esta sesión — la extensión de automatización del navegador se desconectó (mismo patrón ya documentado antes en este proyecto); no se reintentó a ciegas, se dejó constancia acá en vez de simular una verificación que no ocurrió.

---

## 15. Catálogo de marcas de vehículo

El selector "Marca" de "Nueva cotización — Autos" era texto libre. El propio Excel **sí tenía** un dropdown ahí (`DATOS VH!D9`, con validación de datos tipo lista), pero su rango de origen fue borrado en algún momento de la vida del archivo — la validación quedó apuntando a `#REF!`, y no queda ningún nombre definido en el libro con un catálogo recuperable. No hay nada que "extraer" del Excel para esto — confirmado, no asumido.

Se compiló `vehicle_brands` (🌐 catálogo global, sin RLS, mismo trato que `insurers`/`coverages`) a partir del catálogo público real de marcas de Prodeseg (`/api/public/marcas`, ver §13.1 — 192 marcas, sin autenticación), filtrado a las ~66 relevantes para Autos LIVIANO/PICKUP (se excluyeron camiones pesados, motos y maquinaria que ellos cubren pero Delta Check no cotiza) y ordenado por prevalencia real en el mercado ecuatoriano, no alfabético.

`listVehicleBrands()` (`src/actions/catalog.actions.ts`) se consulta directo, sin `withOrganization()` — es catálogo compartido, igual que la lista de aseguradoras. El formulario de nueva cotización (`NuevaCotizacionForm.tsx`) usa un `<select>` con el catálogo que, al elegir una marca, llena el campo de texto real (`name="brand"`) — el campo de texto sigue siendo la fuente de verdad y queda editable, así que "Otra (especificar abajo)" simplemente lo deja vacío para digitación manual. Ningún catálogo de marcas es exhaustivo para siempre; no se bloquea la cotización de una marca fuera de la lista.

**Verificación:** script directo confirma 66 marcas sin duplicados, consultable sin tenant. Confirmado en el HTML servido por el Server Component (`document.querySelectorAll('select')`) que el `<select>` trae las 66 opciones reales de la base más "Otra" — 68 en total. La interacción del `onChange` (copiar la marca elegida al campo de texto) no se pudo probar en vivo por el mismo problema de hidratación de §13 — el patrón de código es idéntico al ya usado (y solo parcialmente verificado por el mismo motivo) en `CedulaLookupButton.tsx`.

---

## 16. Referencia de precio a PatioTuerca (enlace, no integración)

Corrección a §13/§13.1: PatioTuerca **sí publica un avalúo real**, solo que en una página distinta a la del widget interactivo que está roto. En `ecuador.patiotuerca.com/precio/autos/{marca}/{modelo}/{año}` (con año incluido — la sola marca o marca+modelo no lo muestra) la página trae "Precio ideal / Precio más bajo / Precio más alto" calculado sobre sus propias publicaciones.

Revisando el HTML servido (`curl`, sin ejecutar JS) se confirmó que ese precio viene **incrustado en el payload de React Server Components de esa página**, no de una llamada a una API JSON separada — no hay nada limpio que llamar por HTTP. Traerlo por programa exigiría pedir una página por cada combinación marca/modelo/año y parsear el precio de adentro del marcado — eso es scraping de contenido que PatioTuerca genera y publica como propio, no una API pensada para terceros. Mismo criterio de todo este documento: no se construye ahí sin su autorización.

Lo que sí se construyó es un **enlace de referencia**, cero integración: en "Nueva cotización — Autos", junto a Valor comercial, un botón arma la URL a partir de lo que el agente ya escribió (marca/modelo/año) y la abre en pestaña nueva — el agente ve la página real de PatioTuerca con sus propios ojos, ningún dato viaja de vuelta a Delta Check.

```
domains/shared/patiotuerca-link.ts    # buildPatioTuercaUrl() — función pura, testeada
components/shared/PatioTuercaReferenceLink.tsx
```

Patrón de slug de la URL confirmado navegando el sitio real (no adivinado): espacios y puntos se reemplazan por `+`, todo en minúsculas — `"Alfa Romeo"` → `alfa+romeo`, `"Corolla 1.2"` → `corolla+1+2`. Verificado con `find`/`read_page` contra los `href` reales de la página, no inferido del texto visible.

**Verificación:** 5 tests unitarios de `buildPatioTuercaUrl()` (incluye el caso real de Alfa Romeo Mito 2014 que motivó esto), confirmados contra las URLs reales visitadas. Botón confirmado renderizado y visible en el HTML servido por Next.js (`document.querySelectorAll('button')`). El `onClick` (armar la URL final y abrir la pestaña) no se pudo ejercitar en vivo por el mismo problema de hidratación ya reportado — mismo patrón de código (ref + `useState` + handler) que `CedulaLookupButton.tsx`, del que sí se verificó la parte servidor.

---

## 17. Renovación — buscar cotización anterior

Retoma una función que el Excel sí tenía y que había quedado como pendiente sin resolver en la auditoría (EXCEL-AUDIT.md §5): el macro `BUSCAR_BASE_VEHICULOS` traía datos de una cotización/vehículo anterior contra una "REFERENCIA" que el ejecutivo escribía a mano, por `VLOOKUP` con índice de columna sobre la tabla `BASE_VEHICULOS` (120 columnas con nombre). Se leyó esa tabla completa y se contrastó índice por índice contra el código real del macro — el mapeo completo queda documentado en EXCEL-AUDIT.md §5, no se adivinó ningún índice.

**Diferencia deliberada con el Excel:** el macro también copiaba, por cada referencia, la prima que las 13 aseguradoras habían cotizado la vez anterior (idx 50-107 de `BASE_VEHICULOS`) — una copia plana porque Excel no tiene una forma mejor de "recordar" una comparación pasada. Delta Check no replica esa copia: la comparación completa de la cotización anterior ya vive, intacta, en sus propios `quote_options` — no hace falta duplicarla.

**Cómo funciona:** en "Nueva cotización — Autos", junto al botón "Buscar en SRI", un segundo botón "Buscar cotización anterior" busca por el documento ya escrito:

1. `renewalService.findPreviousVehicleData()` (`src/domains/clients/services/renewal.service.ts`) busca el cliente por `documentNumber`, toma su vehículo más reciente, y busca la póliza más reciente ligada a ese vehículo específico (`vehicle → quote_risks → quote_options → policies`).
2. Si encuentra vehículo, precarga Placa/Marca/Modelo/Año/Tipo/Color/Valor comercial/Extras/Rastreo/Ciudad — los mismos campos que ya llena a mano el formulario de cotización nueva.
3. Si además encuentra una póliza emitida para ese vehículo, precarga `previousInsurerId`/`previousPolicyNumber`/`previousExpiryDate` (columnas de `quotes` que ya existían en el esquema desde Fase 1 pero nunca se habían llenado) y pone `operationType` en `RENOVACION`.
4. Nunca bloquea el formulario — cliente nuevo, cliente sin vehículos, o vehículo sin póliza anterior son casos válidos que solo dejan menos precargado, nunca un error.

```
domains/clients/services/renewal.service.ts   # findPreviousVehicleData()
actions/renewal.actions.ts                    # findRenewalData() — audita como renewal.lookup (PII de un cliente ya existente)
components/shared/RenewalLookupButton.tsx
```

**Verificación:** script directo contra Postgres real — crea cliente + vehículo + póliza emitida (simulando "el año pasado"), confirma que `findPreviousVehicleData` trae exactamente esa placa/marca/modelo y esa aseguradora/póliza/fecha de vencimiento, y confirma que una cotización nueva creada con `operationType: RENOVACION` y esos `previousInsurerId`/`previousPolicyNumber` los guarda correctamente en `quotes`. Confirmado en el HTML real servido por Next.js que el botón, el select de Tipo de operación y los campos ocultos de aseguradora/póliza anterior están presentes. El clic en sí no se pudo probar en vivo por el mismo problema de hidratación ya reportado.

---

## 18. Cierre del "autocompletado chico" — provincia, fecha de nacimiento y modelo en cascada

Tres mejoras menores al llenado manual, agrupadas porque comparten el mismo criterio ya establecido en §13/§15/§16: nunca bloquear el formulario, y usar solo fuente real (nunca inventar ni "adivinar" un dato).

**Provincia según cédula.** El código de provincia real del INEC está codificado en los primeros 2 dígitos de la cédula ecuatoriana (01-24, el mismo rango que ya valida `isValidCedula`). `provinceFromCedula()` (`src/domains/lookup/cedula.validator.ts`) resuelve esos 24 códigos a nombre de provincia; `SriCedulaLookupAdapter` lo agrega al resultado `FOUND` sin ninguna llamada extra (es aritmética local, no otra consulta al SRI). `CedulaLookupButton` (ya usado en Autos y Salud) ahora también llena un campo informativo, de solo lectura y no enviable, "Provincia (según cédula)".

**Fecha de nacimiento → edad, en Salud.** El formulario de Salud pedía la edad del titular/dependientes como número suelto — se desactualiza cada año, y `insured_members.birth_date` ya existía en el esquema desde Fase 2 sin usarse. Ahora se pide fecha de nacimiento (`<input type="date">`) y `newHealthQuoteSchema` calcula la edad con un `.transform()` (`calculateAge()`, `src/domains/shared/age.ts`) — `health-quote.actions.ts` no cambió, sigue leyendo `titularAge`/`depNAge` como siempre.

**Modelo en cascada según marca, en Autos.** Mismo origen y mismo criterio que el catálogo de marcas (§15): la API pública de Prodeseg trae, además de `/api/public/marcas`, un endpoint hermano `/api/public/modelos?idM=<id de marca>` — mismo namespace `api/public`, sin autenticación, ya aceptado como fuente para este proyecto. Se consultó una sola vez para las 66 marcas ya curadas (950 modelos reales en total, exportados a `reference-data/vehicle_models.json`) y se sembró en una tabla nueva `vehicle_models` (🌐 global, sin RLS, FK a `vehicle_brands`) — igual que las marcas mismas, **no** se consulta en vivo en cada cotización: el cascadeo es puro cliente, sin depender de que Prodeseg esté disponible mientras el ejecutivo cotiza. Marcas que Delta Check consolida en un solo nombre (`"GREAT WALL (GWM)"`, `"SSANGYONG (KGM)"`) fusionan los modelos de ambas entradas de Prodeseg, sin duplicados.

El campo Modelo sigue siendo texto libre (`required`, mismo `<input>` de siempre) — lo único nuevo es un `<datalist>` que se repuebla en el `onChange` de Marca con los modelos reales de esa marca, como sugerencias de autocompletado nativas del navegador. Si el modelo no está en la lista, se escribe a mano igual que "Otra" en Marca — ningún catálogo restringe la cotización.

```
db/schema/catalog.ts        # vehicleModels — FK a vehicleBrands, único (brandId, name)
db/seed.ts                  # seedVehicleModels() — lee reference-data/vehicle_models.json
actions/catalog.actions.ts  # listVehicleModelsByBrand() — una sola query, agrupada en memoria
```

**Verificación:** `provinceFromCedula` y `calculateAge` con tests unitarios (4 y 5 casos respectivamente, incluido el borde "hoy es el cumpleaños"/"recién nacido"). Los tres flujos completos (provincia persistida en el mensaje de estado, edad calculada y persistida en `insured_members`, catálogo de modelos agrupado por marca) se corrieron además con scripts directos contra Postgres real — incluido el caso de un dependiente recién nacido con `age = 0` (no confundido con "vacío", mismo bug de `""` vs `undefined` que el resto del proyecto). Seed de `vehicle_models` confirmado idempotente (950 filas, sin duplicar en una segunda corrida).

En navegador real (login con el usuario de desarrollo, sesión completa): **fecha de nacimiento → edad se confirmó de punta a punta** — se llenó `1988-05-20` como fecha de nacimiento del titular y se envió el formulario real (`<form action={serverAction}>`, funciona bajo el problema de hidratación de §13 porque usa el *fallback* nativo de POST progresivo, no un `onClick`); la comparativa resultante trajo 78 opciones reales de las 8 aseguradoras de Salud, calculadas con la edad correcta derivada de esa fecha. El catálogo de 66 marcas y el campo Modelo con su `<datalist>` se confirmaron presentes y correctos en el `<select>` real servido. El cascadeo en sí (el `onChange` que repuebla el `<datalist>` al elegir marca) **se probó y no disparó** — mismo `InvariantError: Expected a request ID... self.__next_r` de siempre, reproducido de nuevo en esta sesión, mismo bug de extensión ya reportado dos veces, no una regresión nueva. El botón "Buscar en SRI" (provincia) no se volvió a probar por ser el mismo tipo de control (`onClick`), ya con el mismo resultado documentado en §13.

---

## 19. Login con Microsoft — botón real + filtro de dominio

El provider `MicrosoftEntraID` ya estaba en `auth.ts` desde antes (§11.3), pero solo como *wiring* — sin credenciales configuradas nunca se registraba, y la página de login ni siquiera tenía un botón para lanzarlo. A pedido explícito del usuario se construyó la parte que sí depende de Delta Check, dejando solo las 3 credenciales de Entra ID como lo único externo que falta:

- `src/app/(auth)/login/page.tsx`: un botón real "Iniciar sesión con Microsoft" que llama `signIn("microsoft-entra-id", { redirectTo: "/" })` desde un `<form action={...}>` (Server Action, no `onClick` — funciona bajo el problema de hidratación de §13). El botón **solo se muestra si `AUTH_MICROSOFT_ENTRA_ID_ID`/`_SECRET` ya están configuradas** (mismo criterio que el registro del provider en `auth.ts`: nunca se muestra un control que fallaría al primer clic) — mientras tanto, el texto explica que solo entrarán cuentas `@deltaseguros.com.ec` en cuanto estén.
- `src/domains/identity/microsoft-domain.ts`: `isAllowedMicrosoftEmail()`, función pura (testeada aparte de NextAuth) que valida el dominio del correo.
- `auth.ts`: nuevo callback `signIn` — Delta Check es multi-tenant (§1b), así que "cualquier cuenta de Microsoft válida" no basta. Rechaza en dos casos, cada uno con su propio mensaje (en vez del "AccessDenied" genérico de Auth.js):
  1. El correo no termina en `@deltaseguros.com.ec` → `/login?error=dominio`.
  2. El correo sí es de Delta pero no existe todavía como fila en `users` → `/login?error=sin-acceso`. **No hay alta automática de cuenta en el primer login** — mismo criterio que el provider de desarrollo (`if (!user) return null`): solo entra quien ya fue sembrado. No existe todavía una pantalla de administración de usuarios que permita invitar/dar de alta una cuenta nueva desde la UI; añadirla es trabajo aparte, no incluido acá.

**Verificación:** 5 tests unitarios de `isAllowedMicrosoftEmail` (dominio exacto, mayúsculas, dominio distinto, dominio parecido pero no igual, `null`/`undefined`/vacío). Confirmado en el navegador real, con y sin credenciales configuradas (`.env.local` temporal, restaurado después): sin credenciales el botón no aparece y el texto explica el estado; con credenciales de prueba, el botón sí aparece. Los dos mensajes de rechazo (`?error=dominio`, `?error=sin-acceso`) confirmados renderizando el texto correcto vía `curl` sobre el HTML servido. El flujo OAuth real contra Azure no se pudo probar — Delta todavía no generó el `Tenant ID`/`Client ID`/`Client Secret` reales (§11.3, sigue siendo lo único pendiente de este lado).

---

## 20. Modo oscuro/claro — toggle manual

Los tokens de color para modo oscuro (`@media (prefers-color-scheme: dark)` + override `:root[data-theme]`) ya existían en `globals.css` desde antes de este cambio — el sitio ya respetaba el tema del sistema operativo automáticamente. Lo que faltaba, a pedido del usuario, era un control para forzarlo a mano y que se recuerde.

- `domains/shared/theme.ts`: `parseThemeValue()`/`nextTheme()` — funciones puras, testeadas aparte de React/DOM.
- `components/shared/ThemeToggle.tsx`: botón flotante (arriba a la derecha, en todas las páginas vía `layout.tsx`) que cicla **Sistema → Claro → Oscuro → Sistema**. "Sistema" es el default real y no guarda nada en `localStorage` — quien nunca toca el botón sigue el tema del SO tal cual, nunca queda "congelado" en lo que haya sido el tema del sistema la primera vez que abrió la página. Usa `useSyncExternalStore` (no `useState`+`useEffect`) para leer `localStorage`: es la herramienta correcta de React para sincronizarse con algo externo al render, y evita tanto el parpadeo de hidratación como el antipatrón de `setState` síncrono dentro de un efecto (que el linter del proyecto sí marca como error).
- `app/layout.tsx`: script que aplica el tema guardado **antes del primer paint** (si no, se ve un parpadeo del tema equivocado en cada carga, porque el HTML del servidor no puede saber qué hay en el `localStorage` del navegador). Tiene que ir como `<Script strategy="beforeInteractive">` de `next/script` — **no** un `<script>` a mano dentro de un `<head>` propio: se probó primero así y, aunque el HTML servido sí lo trae (confirmado por `curl`), el navegador nunca lo ejecuta bajo este App Router/Turbopack. `beforeInteractive` es la forma oficialmente soportada de garantizar código antes de la hidratación (`node_modules/next/dist/docs/.../script.md`).

**Verificación:** 4 tests unitarios de `theme.ts` (ciclo completo, valores basura caen a "system" sin lanzar). `npm run typecheck`/`lint`/`test`/`build` limpios. Confirmado en el navegador que el toggle server-rendered aparece correctamente y que forzar `data-theme="light"`/`"dark"` directamente en el DOM cambia instantáneamente los colores computados al token correcto (`getComputedStyle` confirmado pixel a pixel contra los valores de §7). **El clic del botón en sí no se pudo confirmar en vivo** — mismo problema de hidratación de §13, reproducido de nuevo, esta vez con evidencia nueva y más severa: probado tanto en `next dev` como en un build de producción real (`next build && next start`, no solo modo desarrollo), el mismo `InvariantError: self.__next_r` aparece en los dos, y en producción además aparece un segundo error de hidratación de React (`Minified React error #412`) que no se ve en dev. Esto confirma que el problema no es exclusivo del modo desarrollo — es el mismo bug de la extensión de automatización ya reportado dos veces, ahora con alcance más amplio del que se sabía: también rompe `next/script strategy="beforeInteractive"`, no solo los `onClick`.

---

## 20.1 Corrección importante: la CSP bloqueaba la hidratación, no la herramienta de automatización

**Lo que se creía:** desde temprano en este proyecto, cada feature con un `onClick` (Buscar en SRI, cascada de marca→modelo, el link de PatioTuerca, Buscar cotización anterior, el toggle de tema) quedó documentada como "no se pudo confirmar en vivo — problema de hidratación de la herramienta de automatización del navegador, ajeno a la app", reportado dos veces por `SendFeedback` como un bug de esa extensión específica.

**Lo que en realidad pasaba:** `proxy.ts` (desde el primer commit del proyecto, `82db87d`, 2026-09-01) manda una CSP con `script-src 'self' https://www.google.com/recaptcha/` — **sin** `'unsafe-inline'` ni nonce. El comentario que justificaba esto decía "hoy no hay scripts inline en el proyecto", asumiendo que la CSP solo afecta a scripts que el propio código de la app escribe. **Eso es falso**: Next.js siempre inyecta sus propios scripts inline — el bootstrap de hidratación (`self.__next_f.push(...)`, el que arma `self.__next_r`) — sin importar si la app tiene alguno. El navegador los bloqueaba en silencio (una violación de CSP no es un error de JavaScript, solo un `console.warn`, fácil de no ver a menos que se revise la consola a propósito) y React nunca terminaba de hidratar — en **cualquier navegador**, no solo en la herramienta de Claude en Chrome.

**Cómo se encontró:** el usuario probó la demo en su propio Chrome la noche antes de presentarla, reportó "le doy clic y no pasa nada", y esta vez sí compartió la consola del navegador — ahí aparecían las líneas `Executing inline script violates the following Content Security Policy directive 'script-src'...` una por cada script bloqueado, seguidas del mismo `InvariantError: Expected a request ID... self.__next_r` que se venía documentando como bug de la extensión.

**Fix** (`src/proxy.ts`, `src/app/layout.tsx`) — nonce de CSP por request, exactamente como lo documenta Next.js (`node_modules/next/dist/docs/.../content-security-policy.md`):
1. `proxy.ts` genera un nonce nuevo (`crypto.randomUUID()`) en cada request, lo agrega al `script-src` (`'nonce-<valor>' 'strict-dynamic'`) y al `style-src`, y lo manda también como header de **request** (`x-nonce`) además del de response.
2. `layout.tsx` lee ese header con `headers()` (Server Component, ahora `async`) y se lo pasa al `<Script nonce={nonce}>` del tema — Next.js aplica ese mismo nonce automáticamente a todos sus propios scripts inyectados, sin tocarlos uno por uno.
3. `'unsafe-eval'` solo bajo `NODE_ENV === "development"` (React lo necesita ahí para reconstruir stack traces del servidor en el navegador — no se usa en producción).

**Verificado:** confirmado con `curl` que el nonce del header `Content-Security-Policy` de una respuesta coincide exactamente con el atributo `nonce="..."` de los 26 `<script>` que trae esa misma respuesta (antes, cero de esos scripts tenía nonce y todos violaban la CSP). `npm run typecheck`/`lint`/`test`/`build` limpios — el build ahora marca todas las rutas como dinámicas (`ƒ`), esperado: un nonce distinto por request es incompatible con generación estática (el propio doc de Next.js lo advierte).

**Pendiente de re-verificar con esto arreglado** (todo lo que antes decía "no se pudo confirmar por el problema de hidratación" en §13, §15, §16, §17, §18, §19, §20 de este documento): Buscar en SRI, cascada de marca→modelo, el link de PatioTuerca, Buscar cotización anterior, el toggle de tema, y el botón de login con Microsoft en cuanto haya credenciales. Es la prioridad antes de la demo — ver el checklist que se le pasó al usuario en el chat.
