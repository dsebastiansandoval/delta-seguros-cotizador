import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { quotes } from "@/db/schema/quoting";
import { clients } from "@/db/schema/clients";
import { insurers } from "@/db/schema/catalog";
import { offerService, type OfferSheet } from "../offer/offer.service";
import { salutationFor } from "./caratula-salutation";

export type CaratulaData = {
  quoteCode: string;
  date: string;
  clientName: string;
  clientDocument: string;
  /** CARATULA!C7 — ver salutationFor(). */
  salutation: "Señor" | "Señores" | "Señorita" | "Señora";
  /** CARATULA filas 20-30: objeto asegurado (hasta 4 vehículos), valor asegurado, extras y total. */
  vehicles: Array<{ label: string; insuredValueCents: number; extrasValueCents: number }>;
  /** Vigencia proyectada para la portada: hoy → hoy + 1 año (la póliza es anual). */
  coverPageValidity: { from: string; to: string };
  /**
   * Saludo de renovación (CARATULA!C14): menciona la aseguradora y la fecha
   * de vencimiento de la póliza anterior. `null` si es nueva o faltan datos.
   */
  renewal: { previousInsurerName: string; previousExpiryDate: string } | null;
  sheet: OfferSheet;
};

function hasPremium(sheet: OfferSheet): boolean {
  return sheet.kind === "KM"
    ? Boolean(sheet.km?.brackets.some((b) => b.totals))
    : sheet.columns.some((c) => c.totals);
}

/**
 * Lo que imprime la macro IMPRIMIR_OFERTA_VH / IMPRIMIR_OFERTA_XKM: PORTADA,
 * CARATULA (carta) y OFERTA (u OFERTA KM). `null` si todavía no hay ninguna
 * prima — no se arma una oferta vacía.
 */
export async function getCaratulaData(tx: Db, quoteId: string): Promise<CaratulaData | null> {
  const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
  if (!quote) return null;

  const [client] = await tx.select().from(clients).where(eq(clients.id, quote.clientId)).limit(1);
  if (!client) return null;

  const sheet = await offerService.getOfferSheet(tx, quoteId);
  if (!sheet || !hasPremium(sheet)) return null;

  const clientName =
    client.personType === "JURIDICA"
      ? (client.businessName ?? "-")
      : `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "-";

  const today = new Date();
  const nextYear = new Date(today);
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const ddmmyyyy = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

  let renewal: CaratulaData["renewal"] = null;
  if (quote.operationType === "RENOVACION" && quote.previousInsurerId && quote.previousExpiryDate) {
    const [previousInsurer] = await tx.select().from(insurers).where(eq(insurers.id, quote.previousInsurerId)).limit(1);
    if (previousInsurer) {
      // `date` de Postgres llega como "AAAA-MM-DD": se arma con sus partes para no correr el día por huso horario.
      const [y, m, d] = quote.previousExpiryDate.split("-").map(Number);
      renewal = {
        previousInsurerName: previousInsurer.name,
        previousExpiryDate: new Date(y, m - 1, d).toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric" }),
      };
    }
  }

  return {
    quoteCode: quote.code,
    date: today.toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric" }),
    clientName,
    clientDocument: client.documentNumber,
    salutation: salutationFor(client),
    vehicles: sheet.risks.map((r) => ({
      label: r.label,
      insuredValueCents: r.insuredValueCents,
      extrasValueCents: r.extrasValueCents,
    })),
    coverPageValidity: { from: ddmmyyyy(today), to: ddmmyyyy(nextYear) },
    renewal,
    sheet,
  };
}
