-- organization_settings — configuración editable por organización (/admin/configuracion),
-- mismo patrón que src/db/migrations/rls/0007_quote_insurer_settings.sql.

ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON organization_settings
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
