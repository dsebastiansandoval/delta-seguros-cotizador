import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Document, Image, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CaratulaData } from "../services/caratula.service";
import type { OfferSheet } from "../offer/offer.service";
import { INSTALLMENT_TERMS, installmentCents } from "../offer/offer-sheet";
import { ADDITIONAL_ROWS, PREMIUM_ROWS, PRINCIPAL_ROWS, formatMoney, formatOfferCell, formatRate } from "../offer/offer-format";
import { formatUSD } from "@/domains/shared/money";
import { KM_BRACKET_LABELS } from "../constants";

/**
 * Portada real de Delta (`xl/media/image28.jpeg` dentro de
 * COTIZADOR DELTA-1.xlsm — la misma que ya usan en el PDF que le mandan al
 * cliente por WhatsApp, no un diseño nuevo). Se lee una sola vez a un
 * Buffer al cargar el módulo — más simple y más seguro para el tracing de
 * archivos de Next.js en producción que pasarle una ruta a <Image> en cada
 * request. 1766×2795px a 220dpi → 578×915pt (72pt/in), de ahí el tamaño de
 * página custom de PortadaPage (no A4 — se respeta el aspect ratio real de
 * la imagen para que quede a sangre completa, sin franjas).
 */
const PORTADA_AUTOS = readFileSync(join(process.cwd(), "src/domains/quoting/pdf/assets/portada-autos.jpg"));
const PORTADA_SIZE: [number, number] = [578, 915];

/**
 * Logo real de Delta (apilado: triángulo + "DELTA SEGUROS") e isotipos de
 * aseguradoras, extraídos de `COTIZADOR ACTUALIZADO.xlsm` (hoja INFO GENERAL
 * y hoja OFERTA fila 5-7, una imagen por columna C..O) — los mismos que ya
 * usa Delta en el PDF que manda al cliente, no logos nuevos.
 */
const DELTA_LOGO = readFileSync(join(process.cwd(), "src/domains/quoting/pdf/assets/delta-logo-stacked.png"));
const DELTA_LOGO_ASPECT = 303 / 346;

const INSURER_LOGO_ASPECT: Record<string, number> = {
  AIG: 228 / 126,
  SESA: 582 / 116,
  GENERALI: 600 / 81,
  ZURICH: 512 / 120,
  SWEADEN: 441 / 99,
  ATLANTIDA: 404 / 125,
  ALIANZA: 503 / 100,
  CONSTITUCION: 436 / 115,
  UNIDOS: 400 / 233,
  LATINA: 250 / 85,
  ASEGSUR: 250 / 150,
  CHUBB: 3840 / 2160,
  CONDOR: 219 / 50,
};

const INSURER_LOGOS: Record<string, Buffer> = Object.fromEntries(
  Object.keys(INSURER_LOGO_ASPECT).map((code) => [
    code,
    readFileSync(join(process.cwd(), `src/domains/quoting/pdf/assets/insurer-logos/${code}.png`)),
  ]),
);

/** Ajusta un logo a una caja (alto objetivo, ancho máximo) sin deformarlo. */
function fitLogo(aspect: number, targetHeight: number, maxWidth: number) {
  const height = Math.min(targetHeight, maxWidth / aspect);
  return { width: height * aspect, height };
}

const portadaStyles = StyleSheet.create({
  page: { padding: 0 },
  image: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  clientName: {
    position: "absolute",
    top: 300,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 16,
    fontWeight: 700,
    color: "#ffffff",
    textTransform: "uppercase",
  },
  validity: {
    position: "absolute",
    top: 675,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 12,
    fontWeight: 700,
    color: "#ffffff",
  },
});

/**
 * Página 0 — la portada de marca que pedía el usuario ("en 10, sí usa las
 * portadas"). Nombre y vigencia superpuestos sobre los espacios en blanco
 * reales de la plantilla (entre el eslogan y la camioneta, y entre la
 * camioneta y los íconos sociales) — coordenadas estimadas a partir del
 * PDF real que Delta ya manda por WhatsApp, no medidas exactas de diseño;
 * un ajuste fino queda pendiente si al verlo no cae perfecto.
 */
function PortadaPage({ data }: { data: CaratulaData }) {
  return (
    <Page size={PORTADA_SIZE} style={portadaStyles.page}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- <Image> acá es el componente de @react-pdf/renderer (PDF, no DOM); no tiene prop `alt`. */}
      <Image src={PORTADA_AUTOS} style={portadaStyles.image} />
      <Text style={portadaStyles.clientName}>{data.clientName}</Text>
      <Text style={portadaStyles.validity}>
        {data.coverPageValidity.from} — {data.coverPageValidity.to}
      </Text>
    </Page>
  );
}

/**
 * Hoja CARATULA del Excel — la carta. Textos de coberturas, cláusulas y
 * aclaratorio extraídos celda por celda de BASE EMISIONES/CARATULA, no
 * redactados de nuevo.
 */
const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 64, paddingHorizontal: 48, fontSize: 10, fontFamily: "Helvetica", color: "#182338", lineHeight: 1.35 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  date: { color: "#6b6f76" },
  pageFooter: { position: "absolute", bottom: 28, left: 48, right: 48, textAlign: "center", fontSize: 8.5, color: "#6b6f76" },
  footerLink: { color: "#0a589f", textDecoration: "underline" },
  h2: { fontSize: 10.5, fontWeight: 700, color: "#152a52", marginTop: 10, marginBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  label: { color: "#6b6f76" },
  value: { fontWeight: 700 },
  bullet: { flexDirection: "row", marginBottom: 4 },
  bulletMark: { width: 10 },
  bulletText: { flex: 1 },
  footer: { marginTop: 14, color: "#6b6f76" },
});

const COVERAGE_TEXT =
  "Choque y/o volcadura, incendio y/o rayo, explosión, robo total y parcial, hurto, daños " +
  "maliciosos y/o vandalismo, motín, huelga, fenómenos de la naturaleza, rotura de vidrios, " +
  "autoignición, tránsito por caminos no entregados oficialmente al uso público, paso por " +
  "puentes y gabarras, caída de edificios o de objetos que caigan de ellos, derrumbes, " +
  "explosión, rotura de vidrios, impacto de proyectiles, caída de árboles, deslaves, caídas " +
  "de rocas, aludes, responsabilidad civil, gastos de remolque, impacto con objetos sólidos, " +
  "caída de aeronaves o partes de ellas.";

const ADDITIONAL_CLAUSES = [
  "Restitución automática de suma asegurada",
  "Aviso de siniestro 10 días hábiles",
  "Cancelación de la póliza 30 días",
  "Pago de primas 15 días",
];

const DISCLAIMER_NOTES = [
  "El valor asegurado corresponderá al valor real comercial del mercado con una tolerancia de 10% +/-.",
  "En el caso de que el vehículo tenga accesorios no originales, serán considerados como extras y deberán detallarse en la póliza con su valor asegurado. Es obligación del asegurado indicar los accesorios que tenga el vehículo antes de la emisión de la póliza.",
  "Este documento no es una póliza de seguros, ni otorga cobertura al vehículo cotizado. El pago de la póliza debe hacerse por los canales autorizados por las compañías de seguros.",
  "En caso de pérdida total, el valor a indemnizar será el valor comercial a la fecha del siniestro, descontando el deducible de pérdida total establecido por la aseguradora.",
];

function CaratulaLetterPage({ data }: { data: CaratulaData }) {
  const insured = data.vehicles.reduce((sum, v) => sum + v.insuredValueCents, 0);
  const extras = data.vehicles.reduce((sum, v) => sum + v.extrasValueCents, 0);
  const logoSize = fitLogo(DELTA_LOGO_ASPECT, 46, 46);
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.headerRow}>
        <Text style={styles.date}>Quito, {data.date}</Text>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- <Image> acá es el componente de @react-pdf/renderer (PDF, no DOM); no tiene prop `alt`. */}
        <Image src={DELTA_LOGO} style={logoSize} />
      </View>

      <Text>{data.salutation}</Text>
      <Text style={{ marginBottom: 4 }}>{data.clientName}</Text>
      <Text style={{ marginBottom: 12 }}>Presente.-</Text>

      <Text style={{ marginBottom: 12 }}>REFERENCIA: Póliza de Vehículos</Text>

      <Text style={{ marginBottom: 12 }}>
        <Text style={{ fontWeight: 700 }}>De nuestra consideración: </Text>
        {data.renewal
          ? `La presente tiene por objeto recordarle que el día ${data.renewal.previousExpiryDate} vence la póliza en ${data.renewal.previousInsurerName} y que otorga cobertura al vehículo de su propiedad, por tal razón nos permitimos poner en su consideración nuestras mejores ofertas del mercado ecuatoriano.`
          : "nos permitimos poner en su consideración las siguientes opciones cotizadas en el mercado ecuatoriano, para que usted elija la que mejor se ajuste a sus necesidades."}
      </Text>

      <Text style={styles.h2}>OBJETO ASEGURADO</Text>
      {data.vehicles.map((v) => (
        <Text key={v.label} style={styles.value}>
          {v.label}
        </Text>
      ))}
      <View style={[styles.row, { marginTop: 6 }]}>
        <Text style={styles.label}>Valor asegurado</Text>
        <Text style={styles.value}>{formatUSD(insured)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Valor extras</Text>
        <Text style={styles.value}>{extras > 0 ? formatUSD(extras) : "Sin extras"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Total</Text>
        <Text style={styles.value}>{formatUSD(insured + extras)}</Text>
      </View>

      <Text style={styles.h2}>COBERTURAS</Text>
      <Text>{COVERAGE_TEXT}</Text>

      <Text style={styles.h2}>CLÁUSULAS ADICIONALES</Text>
      {ADDITIONAL_CLAUSES.map((clause) => (
        <View style={styles.bullet} key={clause}>
          <Text style={styles.bulletMark}>·</Text>
          <Text style={styles.bulletText}>{clause}</Text>
        </View>
      ))}

      <Text style={styles.h2}>ACLARATORIO</Text>
      {DISCLAIMER_NOTES.map((note) => (
        <View style={styles.bullet} key={note}>
          <Text style={styles.bulletMark}>·</Text>
          <Text style={styles.bulletText}>{note}</Text>
        </View>
      ))}

      <Text style={styles.footer}>Por la favorable atención que se sirva dar a la presente, anticipo mis agradecimientos.</Text>
      <Text style={styles.footer}>Cordialmente,</Text>
      <Text style={{ marginTop: 16, fontWeight: 700, color: "#152a52" }}>DELTASEGUROS CÍA. LTDA.</Text>

      <View style={styles.pageFooter} fixed>
        <Text>Quito: Guayas y Av. Amazonas Edf. Torre Centre Of. 1107</Text>
        <Text>Telf. 0982625495 / 0994889692 / 0995885289</Text>
        <Text style={styles.footerLink}>www.deltaseguros.com.ec</Text>
      </View>
    </Page>
  );
}

// Colores verificados pixel a pixel sobre la comparativa real que manda Delta (COTIZADOR
// ACTUALIZADO.xlsm → hoja OFERTA impresa a PDF): navy en secciones/PRIMA NETA/PRIMA TOTAL,
// azul en los recargos intermedios, ámbar en la fila de riesgos.
const NAVY = "#1c345e";
const BLUE = "#0a589f";
const AMBER = "#fbc053";

const t = StyleSheet.create({
  page: { paddingTop: 16, paddingBottom: 48, paddingHorizontal: 16, fontSize: 6, fontFamily: "Helvetica", color: "#182338" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  table: { borderWidth: 1, borderColor: "#dfe1e6" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#dfe1e6" },
  section: { flexDirection: "row", backgroundColor: NAVY },
  sectionText: { paddingHorizontal: 3, paddingVertical: 1.5, fontWeight: 700, color: "#ffffff" },
  label: { width: 120, paddingHorizontal: 3, paddingVertical: 1.5, fontWeight: 700 },
  cell: { flex: 1, paddingHorizontal: 3, paddingVertical: 1.5, textAlign: "center", borderLeftWidth: 1, borderLeftColor: "#dfe1e6" },
  head: { flex: 1, paddingHorizontal: 3, paddingVertical: 2, textAlign: "center", fontWeight: 700, color: "#ffffff", borderLeftWidth: 1, borderLeftColor: "#38456e" },
  logoCell: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 3, borderLeftWidth: 1, borderLeftColor: "#dfe1e6" },
  nameBox: { width: 120, backgroundColor: NAVY, color: "#ffffff", fontWeight: 700, paddingHorizontal: 3, paddingVertical: 3, justifyContent: "center" },
  pageFooter: { position: "absolute", bottom: 16, left: 16, right: 16, textAlign: "center", fontSize: 6.5, color: "#6b6f76" },
  footerLink: { color: BLUE, textDecoration: "underline" },
});

const tones = StyleSheet.create({
  navyLabel: { width: 120, paddingHorizontal: 3, paddingVertical: 1.5, fontWeight: 700, backgroundColor: NAVY, color: "#ffffff" },
  navyCell: { flex: 1, paddingHorizontal: 3, paddingVertical: 1.5, textAlign: "center", fontWeight: 700, color: "#ffffff", backgroundColor: NAVY, borderLeftWidth: 1, borderLeftColor: "#2a3e66" },
  blueLabel: { width: 120, paddingHorizontal: 3, paddingVertical: 1.5, fontWeight: 700, backgroundColor: BLUE, color: "#ffffff" },
  blueCell: { flex: 1, paddingHorizontal: 3, paddingVertical: 1.5, textAlign: "center", color: "#ffffff", backgroundColor: BLUE, borderLeftWidth: 1, borderLeftColor: "#1c6cb8" },
  amberLabel: { width: 120, paddingHorizontal: 3, paddingVertical: 1.5, fontWeight: 700, backgroundColor: AMBER },
  amberCell: { flex: 1, paddingHorizontal: 3, paddingVertical: 1.5, textAlign: "center", fontWeight: 700, backgroundColor: AMBER, borderLeftWidth: 1, borderLeftColor: "#e0a83a" },
});

function SectionRow({ title }: { title: string }) {
  return (
    <View style={t.section}>
      <Text style={t.sectionText}>{title}</Text>
    </View>
  );
}

type RowTone = "navy" | "blue" | "amber";

function DataRow({ label, values, wrap = false, tone }: { label: string; values: string[]; wrap?: boolean; tone?: RowTone }) {
  const labelStyle = tone === "navy" ? tones.navyLabel : tone === "blue" ? tones.blueLabel : tone === "amber" ? tones.amberLabel : t.label;
  const cellStyle = tone === "navy" ? tones.navyCell : tone === "blue" ? tones.blueCell : tone === "amber" ? tones.amberCell : t.cell;
  return (
    <View style={t.row} wrap={wrap}>
      <Text style={labelStyle}>{label}</Text>
      {values.map((v, i) => (
        <Text key={i} style={cellStyle}>
          {v}
        </Text>
      ))}
    </View>
  );
}

function PageFooter() {
  return (
    <View style={t.pageFooter} fixed>
      <Text>Quito: Guayas y Av. Amazonas Edf. Torre Centre Of. 1107</Text>
      <Text>Telf. 0982625495 / 0994889692 / 0995885289</Text>
      <Text style={t.footerLink}>www.deltaseguros.com.ec</Text>
    </View>
  );
}

/** Hoja OFERTA: una columna por aseguradora marcada "Mostrar", todos los riesgos sumados. */
function OfertaPage({ data, sheet }: { data: CaratulaData; sheet: Extract<OfferSheet, { kind: "ANUAL" }> }) {
  const cols = sheet.columns;
  const deltaLogo = fitLogo(DELTA_LOGO_ASPECT, 38, 38);
  return (
    <Page size="A4" orientation="landscape" style={t.page}>
      <View style={t.topRow}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- <Image> acá es el componente de @react-pdf/renderer (PDF, no DOM); no tiene prop `alt`. */}
        <Image src={DELTA_LOGO} style={deltaLogo} />
      </View>
      <View style={t.table}>
        <View style={t.section}>
          <Text style={t.label}> </Text>
          {cols.map((c) => (
            <Text key={c.insurerId} style={t.head}>
              MODALIDAD ANUAL
            </Text>
          ))}
        </View>
        <View style={t.row}>
          <View style={t.nameBox}>
            <Text>NOMBRE: {data.clientName}</Text>
            <Text>IDENTIFICACION: {data.clientDocument}</Text>
          </View>
          {cols.map((c) => {
            const aspect = INSURER_LOGO_ASPECT[c.insurerCode];
            const logo = aspect ? fitLogo(aspect, 22, 70) : null;
            return (
              <View key={c.insurerId} style={t.logoCell}>
                {logo ? (
                  // eslint-disable-next-line jsx-a11y/alt-text -- <Image> acá es el componente de @react-pdf/renderer (PDF, no DOM); no tiene prop `alt`.
                  <Image src={INSURER_LOGOS[c.insurerCode]} style={logo} />
                ) : (
                  <Text style={{ fontWeight: 700 }}>{c.insurerName}</Text>
                )}
              </View>
            );
          })}
        </View>
        <SectionRow title="COBERTURAS PRINCIPALES" />
        {PRINCIPAL_ROWS.map((r) => (
          <DataRow key={r.key} label={r.label} values={cols.map((c) => formatOfferCell(c.cells[r.key]))} />
        ))}
        <SectionRow title="COBERTURAS ADICIONALES" />
        {ADDITIONAL_ROWS.map((r) => (
          <DataRow key={r.key} label={r.label} values={cols.map((c) => formatOfferCell(c.cells[r.key]))} />
        ))}
        <SectionRow title="DEDUCIBLES" />
        <DataRow label="Pérdidas Parciales" values={cols.map((c) => c.partialDeductible)} />
        <DataRow label="Pérdida Total" values={cols.map((c) => c.totalLossDeductible)} />
        <SectionRow title="RIESGOS" />
        {sheet.risks.map((risk) => (
          <DataRow
            key={risk.id}
            tone="amber"
            label={risk.label}
            values={cols.map((c) => formatRate(c.risks.find((r) => r.riskNumber === risk.riskNumber)?.ratePercentApplied ?? null))}
          />
        ))}
        {PREMIUM_ROWS.map(([label, field], i) => (
          <DataRow key={field} tone={i === 0 ? "navy" : "blue"} label={label} values={cols.map((c) => formatMoney(c.totals?.[field]))} />
        ))}
        <DataRow tone="navy" label="PRIMA TOTAL" values={cols.map((c) => formatMoney(c.totals?.totalPremiumCents))} />
        <SectionRow title="FORMAS DE PAGO" />
        <DataRow label="EFECTIVO O TRANSFERENCIA" values={cols.map((c) => formatMoney(c.totals?.totalPremiumCents))} />
        {INSTALLMENT_TERMS.map((months) => (
          <DataRow
            key={months}
            label={`TARJETA DE CRÉDITO ${months} MESES`}
            values={cols.map((c) => (c.totals ? formatUSD(installmentCents(c.totals.totalPremiumCents, months)) : ""))}
          />
        ))}
      </View>
      <PageFooter />
    </Page>
  );
}

/** Hoja OFERTA KM: una tabla por riesgo, una columna por rango de km. */
function OfertaKmPage({ data, sheet }: { data: CaratulaData; sheet: Extract<OfferSheet, { kind: "KM" }> }) {
  const km = sheet.km;
  if (!km) return null;
  const deltaLogo = fitLogo(DELTA_LOGO_ASPECT, 38, 38);
  const insurerAspect = INSURER_LOGO_ASPECT[km.insurerCode];
  const insurerLogo = insurerAspect ? fitLogo(insurerAspect, 22, 90) : null;
  return (
    <>
      {sheet.risks.map((risk) => {
        const brackets = km.brackets.filter((b) => b.riskNumber === risk.riskNumber);
        const fixed = (value: string) => brackets.map((_, i) => (i === 0 ? value : ""));
        return (
          <Page key={risk.id} size="A4" orientation="landscape" style={t.page}>
            <View style={t.topRow}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- <Image> acá es el componente de @react-pdf/renderer (PDF, no DOM); no tiene prop `alt`. */}
              <Image src={DELTA_LOGO} style={deltaLogo} />
              <View style={{ alignItems: "flex-end" }}>
                {insurerLogo ? (
                  // eslint-disable-next-line jsx-a11y/alt-text -- <Image> acá es el componente de @react-pdf/renderer (PDF, no DOM); no tiene prop `alt`.
                  <Image src={INSURER_LOGOS[km.insurerCode]} style={insurerLogo} />
                ) : (
                  <Text style={{ fontWeight: 700 }}>{km.insurerName}</Text>
                )}
                <Text style={{ marginTop: 2 }}>MODALIDAD AUTO POR KILÓMETRO — {risk.label}</Text>
              </View>
            </View>
            <Text style={{ marginBottom: 6, fontWeight: 700 }}>
              NOMBRE: {data.clientName} — IDENTIFICACION: {data.clientDocument}
            </Text>
            <View style={t.table}>
              <View style={t.section}>
                <Text style={t.label}> </Text>
                {brackets.map((b) => (
                  <Text key={b.quoteOptionId} style={t.head}>
                    {KM_BRACKET_LABELS[b.kmBracket as keyof typeof KM_BRACKET_LABELS]}
                  </Text>
                ))}
              </View>
              <SectionRow title="COBERTURAS" />
              {km.rows.map((row) => (
                <DataRow
                  key={row.key}
                  label={row.label}
                  values={fixed(
                    row.key === "RC"
                      ? formatOfferCell({ amount: (km.rcAmountCents ?? 0) / 100 })
                      : formatOfferCell("amount" in row ? { amount: row.amount } : { text: row.text }),
                  )}
                />
              ))}
              <SectionRow title="DEDUCIBLES" />
              <DataRow label="Pérdidas Parciales" values={fixed(km.partialDeductible)} />
              <DataRow label="Pérdida Total" values={fixed(km.totalLossDeductible)} />
              <DataRow label="TASA" values={brackets.map((b) => formatRate(b.ratePercentApplied))} />
              {PREMIUM_ROWS.map(([label, field], i) => (
                <DataRow key={field} tone={i === 0 ? "navy" : "blue"} label={label} values={brackets.map((b) => formatMoney(b.totals?.[field]))} />
              ))}
              <DataRow tone="navy" label="PRIMA TOTAL" values={brackets.map((b) => formatMoney(b.totals?.totalPremiumCents))} />
            </View>
            <PageFooter />
          </Page>
        );
      })}
    </>
  );
}

export function CaratulaDocument({ data }: { data: CaratulaData }) {
  return (
    <Document title={`Oferta ${data.quoteCode}`}>
      <PortadaPage data={data} />
      <CaratulaLetterPage data={data} />
      {data.sheet.kind === "KM" ? <OfertaKmPage data={data} sheet={data.sheet} /> : <OfertaPage data={data} sheet={data.sheet} />}
    </Document>
  );
}
