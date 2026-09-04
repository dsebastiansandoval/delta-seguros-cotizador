-- policy_installments — Fase 3 (cartera/comisiones/siniestros). Lleva su
-- propio organization_id, mismo patrón simple que policies/commissions/claims
-- en src/db/migrations/rls/0001_row_level_security.sql.

ALTER TABLE policy_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_installments FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON policy_installments
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
