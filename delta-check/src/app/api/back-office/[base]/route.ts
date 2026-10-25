import { NextResponse } from "next/server";
import { withOrganization } from "@/db";
import { BACK_OFFICE_BASES, type BackOfficeBase } from "@/domains/backoffice/services/back-office";
import { backOfficeService } from "@/domains/backoffice/services/back-office.service";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { todayInEcuador } from "@/domains/health/services/health-rate-admin.service";

/** Una hoja BASE del Excel como CSV (para quien siga necesitando la planilla). Solo los ramos del usuario. */
export async function GET(_request: Request, { params }: { params: Promise<{ base: string }> }) {
  const { base } = await params;
  if (!(BACK_OFFICE_BASES as readonly string[]).includes(base)) {
    return NextResponse.json({ error: "Base no encontrada" }, { status: 404 });
  }
  const session = await requirePermission("quote:read_all");
  // Comisiones expone montos de todos los agentes — mismo permiso que /comisiones completa.
  if (base === "comisiones" && !session.permissions.has("commission:read_all")) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const csv = await withOrganization(session.organizationId, (tx) =>
    backOfficeService.exportBase(tx, base as BackOfficeBase, [...session.branches]),
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="base-${base}-${todayInEcuador()}.csv"`,
    },
  });
}
