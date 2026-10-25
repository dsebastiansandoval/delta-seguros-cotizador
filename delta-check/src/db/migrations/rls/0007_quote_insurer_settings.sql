-- quote_insurer_settings — configuración de la oferta por aseguradora (DATOS OFERTA del Excel),
-- mismo patrón que src/db/migrations/rls/0006_quote_executives.sql.

ALTER TABLE quote_insurer_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_insurer_settings FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON quote_insurer_settings
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
