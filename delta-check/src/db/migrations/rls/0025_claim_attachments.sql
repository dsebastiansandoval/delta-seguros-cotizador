-- claim_attachments — metadata de adjuntos de un siniestro (el archivo en
-- sí vive en S3). Mismo patrón simple que claim_events en
-- src/db/migrations/rls/0024_claim_events.sql.

ALTER TABLE claim_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_attachments FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON claim_attachments
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
