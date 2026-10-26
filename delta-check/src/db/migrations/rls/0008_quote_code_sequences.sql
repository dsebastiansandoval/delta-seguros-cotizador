-- quote_code_sequences — correlativo real de quotes.code por organización y
-- año, mismo patrón simple que quote_sources/quote_executives en
-- src/db/migrations/rls/0005_quote_sources.sql.

ALTER TABLE quote_code_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_code_sequences FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON quote_code_sequences
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
