import { createElement } from "react";
import type { ReactElement } from "react";
import { NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { withOrganization } from "@/db";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { getCaratulaAMData } from "@/domains/health/services/caratula-am.service";
import { CaratulaAMDocument } from "@/domains/health/pdf/CaratulaAMDocument";
import { audit } from "@/domains/shared/audit";

/** Equivalente de Salud a /api/quotes/[quoteId]/caratula (Autos) — mismo contrato: ?quoteOptionId= repetible. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { quoteId } = await params;
  const session = await requirePermission("quote:read");

  const quoteOptionIds = new URL(request.url).searchParams.getAll("quoteOptionId");

  const data = await withOrganization(session.organizationId, async (tx) => {
    const caratula = await getCaratulaAMData(tx, quoteId, quoteOptionIds.length > 0 ? quoteOptionIds : undefined);
    if (caratula) {
      await audit(tx, {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "quote.caratula_am_downloaded",
        entityType: "quotes",
        entityId: quoteId,
        metadata: { insurerCount: caratula.offers.length, comparison: caratula.offers.length > 1 },
      });
    }
    return caratula;
  });

  if (!data) {
    return NextResponse.json(
      { error: "Todavía no hay ninguna aseguradora cotizada para esta cotización" },
      { status: 404 },
    );
  }

  const element = createElement(CaratulaAMDocument, { data }) as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);

  const filename = data.offers.length > 1 ? `caratula-am-comparativa-${data.quoteCode}.pdf` : `caratula-am-${data.quoteCode}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
