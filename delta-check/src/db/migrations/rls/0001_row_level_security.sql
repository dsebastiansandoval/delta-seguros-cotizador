-- Row Level Security — aislamiento por tenant (ARCHITECTURE.md §1b).
-- Escrita a mano, no generada por drizzle-kit: drizzle-kit no versiona
-- políticas RLS, así que esto vive aparte y se aplica con
-- `psql -f` (o el runner de migraciones custom cuando exista uno).
--
-- Convención: cada tabla 🏢 se activa con RLS y una política que compara
-- organization_id contra el setting de sesión app.current_org_id, fijado
-- por withOrganization() en src/db/index.ts dentro de una transacción.
--
-- rate_tables es la única excepción: además de la fila propia, deja leer
-- (nunca escribir) las filas marcadas visibility = 'TEMPLATE' de cualquier
-- tenant — ver ARCHITECTURE.md §1b "rate_tables como plantilla".

-- ── Tablas con aislamiento simple ──────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organization_integrations',
    'users',
    'user_roles',
    'clients',
    'vehicles',
    'insured_groups',
    'insured_members',
    'insurer_coverages',
    'deductible_rules',
    'quotes',
    'quote_risks',
    'quote_options',
    'quote_option_coverages',
    'payment_options',
    'policies',
    'policy_events',
    'commissions',
    'claims',
    'consents',
    'audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t); -- también aplica al dueño de la tabla
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (organization_id = current_setting(''app.current_org_id'', true)::uuid)
         WITH CHECK (organization_id = current_setting(''app.current_org_id'', true)::uuid)',
      t
    );
  END LOOP;
END $$;

-- ── rate_tables: aislamiento + excepción de lectura para plantillas ────────
-- (ARCHITECTURE.md §1b — el USING se relaja en lectura, el WITH CHECK nunca)
ALTER TABLE rate_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_tables FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_with_templates ON rate_tables
  USING (
    organization_id = current_setting('app.current_org_id', true)::uuid
    OR visibility = 'TEMPLATE'
  )
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- ── rate_rules: no lleva organization_id propio, hereda de su rate_table ───
-- (a propósito — no se duplica el campo). La política se apoya en un EXISTS
-- contra rate_tables, que ya resuelve el caso propio + plantilla.
ALTER TABLE rate_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_rules FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_via_rate_table ON rate_rules
  USING (
    EXISTS (
      SELECT 1 FROM rate_tables rt
      WHERE rt.id = rate_rules.rate_table_id
        AND (
          rt.organization_id = current_setting('app.current_org_id', true)::uuid
          OR rt.visibility = 'TEMPLATE'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rate_tables rt
      WHERE rt.id = rate_rules.rate_table_id
        AND rt.organization_id = current_setting('app.current_org_id', true)::uuid
    )
  );

-- ── audit_logs: append-only, ni siquiera el rol de aplicación puede tocarlo ─
-- (ARCHITECTURE.md §8.3/§9 — se revoca a nivel de rol de base de datos, no
-- solo de RLS, porque RLS no impide UPDATE/DELETE por sí sola sin GRANT).
-- El rol app_rw se crea en la migración de roles de BD (pendiente, ver
-- ARCHITECTURE.md §8.3) — este REVOKE es un no-op seguro si el rol no existe
-- todavía en un entorno de desarrollo local.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN
    REVOKE UPDATE, DELETE ON audit_logs FROM app_rw;
  END IF;
END $$;

-- ── organizations: no lleva organization_id (ES el tenant) ─────────────────
-- No se activa RLS acá — el acceso se controla por rol de aplicación
-- (PLATFORM_ADMIN ve todas; el resto solo la suya, filtrado en el servicio
-- de dominio, no en la fila, porque cada usuario ya sabe su propio
-- organization_id desde la sesión).
