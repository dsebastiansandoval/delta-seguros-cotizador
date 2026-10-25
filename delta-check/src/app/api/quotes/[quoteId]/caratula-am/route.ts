import { createElement } from "react";
import type { ReactElement } from "react";
import { NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { withOrganization } from "@/db";
import { requireBranch, requirePermission } from "@/domains/identity/services/rbac.service";
import { getCaratulaAMData } from "@/domains/health/services/caratula-am.service";
import { CaratulaAMDocument } from "@/domains/health/pdf/CaratulaAMDocument";
import { audit } from "@/domains/shared/audit";

/** PDF de Salud (IMPRIMIR_OFERTA_AM): portada, carta y OFERTA AM con los planes marcados "Mostrar". */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { quoteId } = await params;
  const session = await requirePermission("quote:read");
  requireBranch(session, "SALUD");

  const data = await withOrganization(session.organizationId, async (tx) => {
    const caratula = await getCaratulaAMData(tx, quoteId);
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
      { error: "No hay planes marcados para mostrar en la oferta" },
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
