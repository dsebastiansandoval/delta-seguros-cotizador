-- claim_events — historial de novedades de un siniestro, append-only.
-- Mismo patrón simple que policy_installments en 0003_policy_installments.sql.

ALTER TABLE claim_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_events FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON claim_events
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
