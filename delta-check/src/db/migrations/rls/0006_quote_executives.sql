-- quote_executives — EJECUTIVO del Excel (DATOS VH!D8), mismo patrón que
-- quote_sources en src/db/migrations/rls/0005_quote_sources.sql.

ALTER TABLE quote_executives ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_executives FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON quote_executives
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
