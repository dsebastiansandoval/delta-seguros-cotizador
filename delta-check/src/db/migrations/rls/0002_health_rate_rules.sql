-- health_rate_rules — mismo patrón que rate_rules en
-- src/db/migrations/rls/0001_row_level_security.sql: no lleva
-- organization_id propio, hereda de su rate_table padre vía EXISTS
-- (incluye el caso TEMPLATE, ARCHITECTURE.md §1b).

ALTER TABLE health_rate_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_rate_rules FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_via_rate_table ON health_rate_rules
  USING (
    EXISTS (
      SELECT 1 FROM rate_tables rt
      WHERE rt.id = health_rate_rules.rate_table_id
        AND (
          rt.organization_id = current_setting('app.current_org_id', true)::uuid
          OR rt.visibility = 'TEMPLATE'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rate_tables rt
      WHERE rt.id = health_rate_rules.rate_table_id
        AND rt.organization_id = current_setting('app.current_org_id', true)::uuid
    )
  );
