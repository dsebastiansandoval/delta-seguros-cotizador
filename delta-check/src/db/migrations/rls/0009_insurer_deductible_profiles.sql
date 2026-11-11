-- insurer_deductible_profiles — override editable de /admin/deducibles, mismo patrón que
-- src/db/migrations/rls/0007_quote_insurer_settings.sql.

ALTER TABLE insurer_deductible_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurer_deductible_profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON insurer_deductible_profiles
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
