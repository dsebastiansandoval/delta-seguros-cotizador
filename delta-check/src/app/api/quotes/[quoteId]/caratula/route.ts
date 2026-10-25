import { createElement } from "react";
import type { ReactElement } from "react";
import { NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { withOrganization } from "@/db";
import { requireBranch, requirePermission } from "@/domains/identity/services/rbac.service";
import { getCaratulaData } from "@/domains/quoting/services/caratula.service";
import { CaratulaDocument } from "@/domains/quoting/pdf/CaratulaDocument";
import { audit } from "@/domains/shared/audit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { quoteId } = await params;
  const session = await requirePermission("quote:read");
  requireBranch(session, "AUTOS");

  const data = await withOrganization(session.organizationId, async (tx) => {
    const caratula = await getCaratulaData(tx, quoteId);
    if (caratula) {
      await audit(tx, {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "quote.caratula_downloaded",
        entityType: "quotes",
        entityId: quoteId,
        metadata: {
          insurerCount: caratula.sheet.kind === "ANUAL" ? caratula.sheet.columns.length : 1,
          modality: caratula.sheet.kind,
        },
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

  // CaratulaDocument envuelve <Document> pero no es literalmente un
  // ReactElement<DocumentProps> a nivel de tipos — renderToBuffer solo
  // necesita que el árbol resuelva a un <Document> en tiempo de ejecución,
  // que es justo lo que hace. Cast explícito, patrón común envolviendo
  // <Document> en un componente propio.
  const element = createElement(CaratulaDocument, { data }) as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);

  const filename = `oferta-${data.quoteCode}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
