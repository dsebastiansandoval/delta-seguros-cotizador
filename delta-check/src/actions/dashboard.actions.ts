"use server";

import { withOrganization } from "@/db";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { dashboardService } from "@/domains/dashboard/services/dashboard.service";

/** Vista agregada de todo el tenant — gate por quote:read_all, mismo nivel que ver comisiones de todos los agentes. */
export async function getDashboardSummary() {
  const session = await requirePermission("quote:read_all");
  return withOrganization(session.organizationId, (tx) => dashboardService.getSummary(tx, session.organizationId));
}
