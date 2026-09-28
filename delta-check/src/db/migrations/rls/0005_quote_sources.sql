-- quote_sources — FUENTE del Excel (INFO GENERAL!T15:T43), catálogo propio
-- de cada tenant (la nómina de quién trae clientes), no un catálogo global
-- como vehicle_brands. Mismo patrón simple que policy_installments/
-- arco_requests en src/db/migrations/rls/0003_policy_installments.sql.

ALTER TABLE quote_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_sources FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON quote_sources
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
