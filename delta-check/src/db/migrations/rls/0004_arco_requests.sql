-- arco_requests — Fase 3 (KPIs/ARCO). Lleva su propio organization_id,
-- mismo patrón simple que policies/commissions/claims en
-- src/db/migrations/rls/0001_row_level_security.sql.

ALTER TABLE arco_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE arco_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON arco_requests
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
