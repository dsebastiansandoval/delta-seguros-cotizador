-- quote_vendors — catálogo de VENDEDOR para externos sin cuenta propia
-- (ver src/db/schema/clients.ts). Mismo patrón simple que quote_sources
-- (src/db/migrations/rls/0005_quote_sources.sql).

ALTER TABLE quote_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_vendors FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON quote_vendors
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
