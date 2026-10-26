"use server";

import { withOrganization } from "@/db";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { dashboardService } from "@/domains/dashboard/services/dashboard.service";
import { parseReportMonth } from "@/domains/dashboard/services/agent-report";

/**
 * Vista agregada del tenant, solo de los ramos del usuario — gate por
 * quote:read_all, mismo nivel que ver comisiones de todos los agentes.
 */
export async function getDashboardSummary() {
  const session = await requirePermission("quote:read_all");
  const branches = [...session.branches];
  if (!branches.length) return null;
  return withOrganization(session.organizationId, (tx) => dashboardService.getSummary(tx, session.organizationId, branches));
}

/** Reporte por ejecutivo — mismo permiso que el resto del dashboard (ve a todos los agentes), solo sus ramos. */
export async function getAgentReport(params: { mes?: string; ramo?: string }) {
  const session = await requirePermission("quote:read_all");
  const month = parseReportMonth(params.mes);
  const branch: "AUTOS" | "SALUD" | undefined =
    (params.ramo === "AUTOS" || params.ramo === "SALUD") && session.branches.has(params.ramo) ? params.ramo : undefined;
  const report = await withOrganization(session.organizationId, (tx) =>
    dashboardService.getAgentReport(tx, session.organizationId, { month, branch, branches: [...session.branches] }),
  );
  return { month, branch, ...report };
}
