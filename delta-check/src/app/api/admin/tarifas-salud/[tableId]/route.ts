import { NextResponse } from "next/server";
import { withOrganization } from "@/db";
import { healthRatesToCsv } from "@/domains/health/services/health-rate-csv";
import { healthRateAdminService } from "@/domains/health/services/health-rate-admin.service";
import { requirePermission } from "@/domains/identity/services/rbac.service";

/** Una tabla de Salud como CSV — la plantilla que el ADMIN edita y vuelve a subir. */
export async function GET(_request: Request, { params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = await params;
  const session = await requirePermission("rate:edit");
  if (!/^[0-9a-f-]{36}$/i.test(tableId)) return NextResponse.json({ error: "Tabla no encontrada" }, { status: 404 });

  const table = await withOrganization(session.organizationId, (tx) => healthRateAdminService.findTable(tx, tableId));
  if (!table) return NextResponse.json({ error: "Tabla no encontrada" }, { status: 404 });

  return new NextResponse(healthRatesToCsv(table.rules), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tarifas-${table.insurerCode.toLowerCase()}-${table.validFrom}.csv"`,
    },
  });
}
