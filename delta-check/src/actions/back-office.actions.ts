"use server";

import { withOrganization } from "@/db";
import { backOfficeService } from "@/domains/backoffice/services/back-office.service";
import { parseReportMonth } from "@/domains/dashboard/services/agent-report";
import { requirePermission } from "@/domains/identity/services/rbac.service";

/** Colas de todo el tenant (no solo las propias) → quote:read_all, como el dashboard. Solo los ramos del usuario. */
export async function getBackOfficeOverview(params: { mes?: string }) {
  const session = await requirePermission("quote:read_all");
  const month = parseReportMonth(params.mes);
  const overview = await withOrganization(session.organizationId, (tx) =>
    backOfficeService.overview(tx, {
      branches: [...session.branches],
      month,
      includeCommissions: session.permissions.has("commission:read_all"),
    }),
  );
  return { month, overview };
}
