import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withOrganization } from "@/db";
import { insurers } from "@/db/schema/catalog";
import { blankHealthRateCsv } from "@/domains/health/services/health-rate-csv";
import { ratedPlanCodes } from "@/domains/health/services/health-rate-admin.service";
import { requirePermission } from "@/domains/identity/services/rbac.service";

/** CSV en blanco con los códigos de plan de una aseguradora — para la primera carga, cuando todavía no tiene ninguna tabla. */
export async function GET(_request: Request, { params }: { params: Promise<{ insurerId: string }> }) {
  const { insurerId } = await params;
  const session = await requirePermission("rate:edit");
  if (!/^[0-9a-f-]{36}$/i.test(insurerId)) return NextResponse.json({ error: "Aseguradora no encontrada" }, { status: 404 });

  const insurer = await withOrganization(session.organizationId, async (tx) => {
    const [row] = await tx.select().from(insurers).where(eq(insurers.id, insurerId)).limit(1);
    return row ?? null;
  });
  if (!insurer || insurer.branch !== "SALUD") return NextResponse.json({ error: "Aseguradora no encontrada" }, { status: 404 });

  const planCodes = ratedPlanCodes(insurer.code);
  if (!planCodes.length) return NextResponse.json({ error: "Esta aseguradora no tiene tabla de tarifas" }, { status: 400 });

  return new NextResponse(blankHealthRateCsv(planCodes), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="plantilla-tarifas-${insurer.code.toLowerCase()}.csv"`,
    },
  });
}
