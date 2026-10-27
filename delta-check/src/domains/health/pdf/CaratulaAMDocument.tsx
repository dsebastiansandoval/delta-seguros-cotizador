import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Document, Image, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CaratulaAMData } from "../services/caratula-am.service";
import { formatUSD } from "@/domains/shared/money";
import { coverageRows, coverageValueFor, memberLabels, planLabel } from "../services/health-offer-format";

/**
 * Portada real de Salud/AM (`xl/media/image60.jpeg` dentro de COTIZADOR
 * DELTA-1.xlsm — misma familia de diseño que la portada de Autos, "Tu
 * salud es nuestra prioridad"). 1710×2419px a 220dpi → 560×792pt.
 */
const PORTADA_SALUD = readFileSync(join(process.cwd(), "src/domains/quoting/pdf/assets/portada-salud.jpg"));
const PORTADA_SIZE: [number, number] = [560, 792];

/**
 * Logo real de Delta (mismo PNG que usa Autos, `CaratulaDocument.tsx` —
 * no se duplica el archivo, se referencia la misma ruta) — reemplaza el
 * texto "DELTA SEGUROS / Cía. Ltda." a pedido del usuario, que compartió
 * un PDF real (`OFERTA AM` impresa, IMPRIMIR_OFERTA_AM) donde la carta y
 * las tablas siempre llevan el isotipo, nunca el nombre en texto plano.
 */
const DELTA_LOGO = readFileSync(join(process.cwd(), "src/domains/quoting/pdf/assets/delta-logo-stacked.png"));
const DELTA_LOGO_ASPECT = 303 / 346;

/**
 * Logos de las aseguradoras de Salud, extraídos de `COTIZADOR
 * ACTUALIZADO.xlsm` (hoja DATOS AM y las hojas propias BUPA/CONFIAMED/
 * HUMANA/PRO/VB — recortados a su bounding box real, sin el badge de
 * "Vitality" que trae pegado el de SaludSA en el Excel) — mismos logos que
 * ya usa Delta en el PDF real que manda al cliente. SALUD (genérica) no
 * tiene un logo propio embebido en ningún lado del libro — cae al nombre
 * en texto, mismo criterio de respaldo que ya usa Autos para aseguradoras
 * sin logo en `INSURER_LOGO_ASPECT`.
 */
const INSURER_LOGO_ASPECT: Record<string, number> = {
  BMI: 456 / 181,
  HUMANA: 351 / 102,
  CONFIAMED: 382 / 113,
  SALUDSA: 432 / 103,
  BUPA: 337 / 137,
  PRO: 426 / 101,
  VB: 448 / 117,
};

const INSURER_LOGOS: Record<string, Buffer> = Object.fromEntries(
  Object.keys(INSURER_LOGO_ASPECT).map((code) => [
    code,
    readFileSync(join(process.cwd(), `src/domains/health/pdf/assets/insurer-logos/${code}.png`)),
  ]),
);

/** Ajusta un logo a una caja (alto objetivo, ancho máximo) sin deformarlo — igual que Autos. */
function fitLogo(aspect: number, targetHeight: number, maxWidth: number) {
  const height = Math.min(targetHeight, maxWidth / aspect);
  return { width: height * aspect, height };
}

const portadaStyles = StyleSheet.create({
  page: { padding: 0 },
  image: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  clientName: {
    position: "absolute",
    top: 230,
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
    top: 555,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 12,
    fontWeight: 700,
    color: "#ffffff",
  },
});

function PortadaAMPage({ data }: { data: CaratulaAMData }) {
  return (
    <Page size={PORTADA_SIZE} style={portadaStyles.page}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- <Image> acá es el componente de @react-pdf/renderer (PDF, no DOM); no tiene prop `alt`. */}
      <Image src={PORTADA_SALUD} style={portadaStyles.image} />
      <Text style={portadaStyles.clientName}>{data.clientName}</Text>
      <Text style={portadaStyles.validity}>
        {data.coverPageValidity.from} — {data.coverPageValidity.to}
      </Text>
    </Page>
  );
}

/**
 * Equivalente de Salud a `CaratulaDocument.tsx` (Autos) — a diferencia de
 * esa hoja `CARATULA`, `CARATULA AM` está completamente vacía en el Excel
 * (solo la imagen flotante de portada, sin una sola fórmula de texto), así
 * que el saludo/cláusulas/aclaratorio de esta carta son redactados de
 * nuevo, con el mismo tono que la carta real de Autos — no una extracción
 * celda por celda como esa. Los números (prima neta, OTROS CARGOS, 0.5%
 * campesino, total) sí son reales — ver ARCHITECTURE.md §31.
 */
const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 64, paddingHorizontal: 42, fontSize: 10.5, fontFamily: "Helvetica", color: "#182338", lineHeight: 1.4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  date: { color: "#6b6f76" },
  pageFooter: { position: "absolute", bottom: 28, left: 42, right: 42, textAlign: "center", fontSize: 8.5, color: "#6b6f76" },
  footerLink: { color: "#0a589f", textDecoration: "underline" },
  h2: { fontSize: 11, fontWeight: 700, color: "#152a52", marginTop: 12, marginBottom: 5 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  label: { color: "#6b6f76" },
  value: { fontWeight: 700 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#dfe1e6",
    borderTopStyle: "dashed",
  },
  totalLabel: { fontSize: 12, fontWeight: 700 },
  totalValue: { fontSize: 14, fontWeight: 700, color: "#01579e" },
  footer: { marginTop: 16, color: "#6b6f76" },
  paymentRow: { flexDirection: "row", justifyContent: "space-between" },
  paymentCol: { flex: 1, alignItems: "center" },
  paymentTerm: { color: "#6b6f76", fontSize: 9, marginBottom: 2 },
  paymentValue: { fontWeight: 700 },
});

/** Pie de página real — mismos datos que ya usa Autos, extraídos del PDF real (`IMPRIMIR_OFERTA_AM`). */
function AMPageFooter() {
  return (
    <View style={styles.pageFooter} fixed>
      <Text>Quito: Guayas y Av. Amazonas Edf. Torre Centre Of. 1107</Text>
      <Text>Telf. 0982625495 / 0994889692 / 0995885289</Text>
      <Text style={styles.footerLink}>www.deltaseguros.com.ec</Text>
    </View>
  );
}

const INSTALLMENT_TERMS = [6, 9, 12] as const;

const REGION_LABEL: Record<CaratulaAMData["region"], string> = {
  SIERRA: "Sierra",
  COSTA: "Costa",
  AUSTRO: "Austro",
};

function CaratulaAMLetterPage({ data }: { data: CaratulaAMData }) {
  const labels = memberLabels(data.members);
  const logoSize = fitLogo(DELTA_LOGO_ASPECT, 46, 46);
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.headerRow}>
        <Text style={styles.date}>Quito, {data.date}</Text>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- <Image> acá es el componente de @react-pdf/renderer (PDF, no DOM); no tiene prop `alt`. */}
        <Image src={DELTA_LOGO} style={logoSize} />
      </View>

      <Text>Señores</Text>
      <Text style={{ marginBottom: 4 }}>{data.clientName}</Text>
      <Text style={{ marginBottom: 8 }}>Presente.-</Text>

      <Text style={{ marginBottom: 8 }}>REFERENCIA: Cotización Seguro Médico — {REGION_LABEL[data.region]}</Text>

      <Text style={{ marginBottom: 8 }}>
        <Text style={{ fontWeight: 700 }}>De nuestra consideración: </Text>
        nos permitimos poner en su consideración las siguientes opciones de seguro médico cotizadas en el
        mercado ecuatoriano, para que usted elija la que mejor se ajuste a las necesidades de su grupo
        familiar.
      </Text>

      <Text style={styles.h2}>GRUPO ASEGURADO</Text>
      {labels.map((label, i) => (
        <View style={styles.row} key={i}>
          <Text style={styles.label}>{label}</Text>
        </View>
      ))}

      <Text style={styles.h2}>ACLARATORIO</Text>
      <Text>
        Este documento no es una póliza de seguros, ni otorga cobertura médica. El pago de la póliza debe
        hacerse por los canales autorizados por las compañías de seguros.
      </Text>

      <Text style={styles.footer}>
        Por la favorable atención que se sirva dar a la presente, anticipo mis agradecimientos.
      </Text>
      <Text style={styles.footer}>Cordialmente,</Text>
      <Text style={{ marginTop: 10, fontWeight: 700, color: "#152a52" }}>DELTASEGUROS CÍA. LTDA.</Text>

      <AMPageFooter />
    </Page>
  );
}

// Ámbar verificado contra el PDF real (IMPRIMIR_OFERTA_AM): las 3 filas de
// descuento (sin descuento/especial/de contado) siempre van resaltadas,
// mismo tono que usa Autos para la fila de riesgos (CaratulaDocument.tsx).
const AM_AMBER = "#fbc053";

const tableStyles = StyleSheet.create({
  page: { paddingTop: 20, paddingBottom: 44, paddingHorizontal: 24, fontSize: 7.5, fontFamily: "Helvetica", color: "#182338" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  table: { borderWidth: 1, borderColor: "#dfe1e6" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#dfe1e6" },
  sectionRow: { flexDirection: "row", backgroundColor: "#152a52" },
  labelCell: { width: 140, padding: 4, fontWeight: 700, color: "#182338" },
  sectionLabelCell: { width: 140, padding: 4, fontWeight: 700, color: "#ffffff" },
  dataCell: { flex: 1, padding: 4, textAlign: "center", borderLeftWidth: 1, borderLeftColor: "#dfe1e6" },
  headerCell: {
    flex: 1,
    padding: 4,
    textAlign: "center",
    fontWeight: 700,
    color: "#ffffff",
    borderLeftWidth: 1,
    borderLeftColor: "#38456e",
  },
  logoCell: { flex: 1, alignItems: "center", justifyContent: "center", padding: 4, borderLeftWidth: 1, borderLeftColor: "#dfe1e6" },
  totalsRow: { flexDirection: "row", backgroundColor: "#fef3e0" },
  totalsLabelCell: { width: 140, padding: 4, fontWeight: 700 },
  totalsDataCell: {
    flex: 1,
    padding: 4,
    textAlign: "center",
    fontWeight: 700,
    color: "#01579e",
    borderLeftWidth: 1,
    borderLeftColor: "#dfe1e6",
  },
  amberRow: { flexDirection: "row", backgroundColor: AM_AMBER },
  amberLabelCell: { width: 140, padding: 4, fontWeight: 700 },
  amberDataCell: { flex: 1, padding: 4, textAlign: "center", fontWeight: 700, borderLeftWidth: 1, borderLeftColor: "#e0a83a" },
  pageFooter: { position: "absolute", bottom: 16, left: 24, right: 24, textAlign: "center", fontSize: 6.5, color: "#6b6f76" },
  footerLink: { color: "#0a589f", textDecoration: "underline" },
});

/** Las 2 filas de cabecera de la grilla/precios apaisada — plan arriba (navy), logo de la aseguradora debajo (blanco), igual que el PDF real. */
function OfferTableHeader({ data }: { data: CaratulaAMData }) {
  return (
    <>
      <View style={tableStyles.sectionRow}>
        <Text style={tableStyles.sectionLabelCell}> </Text>
        {data.offers.map((o, i) => (
          <Text key={i} style={tableStyles.headerCell}>
            {planLabel(o.planCode)}
          </Text>
        ))}
      </View>
      <View style={tableStyles.row}>
        <Text style={tableStyles.labelCell}> </Text>
        {data.offers.map((o, i) => {
          const aspect = INSURER_LOGO_ASPECT[o.insurerCode];
          const logo = aspect ? fitLogo(aspect, 20, 90) : null;
          return (
            <View key={i} style={tableStyles.logoCell}>
              {logo ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- <Image> acá es el componente de @react-pdf/renderer (PDF, no DOM); no tiene prop `alt`.
                <Image src={INSURER_LOGOS[o.insurerCode]} style={logo} />
              ) : (
                <Text style={{ fontWeight: 700 }}>{o.insurerName}</Text>
              )}
            </View>
          );
        })}
      </View>
    </>
  );
}

function AMTablePageFooter() {
  return (
    <View style={tableStyles.pageFooter} fixed>
      <Text>Quito: Guayas y Av. Amazonas Edf. Torre Centre Of. 1107</Text>
      <Text>Telf. 0982625495 / 0994889692 / 0995885289</Text>
      <Text style={tableStyles.footerLink}>www.deltaseguros.com.ec</Text>
    </View>
  );
}

/**
 * Grilla ancha de coberturas — equivalente a imprimir directo la sección
 * COBERTURAS/MATERNIDAD/TOPE CONSULTA/PERIODOS DE CARENCIA de `OFERTA AM`
 * (macro `IMPRIMIR_OFERTA_AM`). Une los labels de TODAS las ofertas (no
 * solo la primera) por si un plan trae una fila que otro no, ordenados por
 * el mismo `displayOrder` real del Excel — "—" cuando el plan no tiene esa
 * fila sembrada, nunca un valor inventado.
 */
function CoverageGridPage({ data }: { data: CaratulaAMData }) {
  const rowsWithHeaders = coverageRows(data.offers);
  if (rowsWithHeaders.length === 0) return null;
  const valueFor = coverageValueFor;
  const deltaLogo = fitLogo(DELTA_LOGO_ASPECT, 32, 32);

  return (
    <Page size="A4" orientation="landscape" style={tableStyles.page}>
      <View style={tableStyles.topRow}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- <Image> acá es el componente de @react-pdf/renderer (PDF, no DOM); no tiene prop `alt`. */}
        <Image src={DELTA_LOGO} style={deltaLogo} />
        <Text style={{ fontSize: 11, fontWeight: 700, color: "#152a52" }}>Coberturas por plan — {data.clientName}</Text>
      </View>
      <View style={tableStyles.table}>
        <OfferTableHeader data={data} />
        {rowsWithHeaders.map(({ label, section, showSectionHeader }) => {
          return (
            <View key={label}>
              {showSectionHeader && (
                <View style={tableStyles.sectionRow}>
                  <Text style={[tableStyles.sectionLabelCell, { width: "100%" }]}>{section.replace(/_/g, " ")}</Text>
                </View>
              )}
              <View style={tableStyles.row}>
                <Text style={tableStyles.labelCell}>{label}</Text>
                {data.offers.map((o, i) => (
                  <Text key={i} style={tableStyles.dataCell}>
                    {valueFor(o, label)}
                  </Text>
                ))}
              </View>
            </View>
          );
        })}
      </View>
      <AMTablePageFooter />
    </Page>
  );
}

/** Tabla ancha de precios/descuentos — equivalente a la sección TITULAR-DEPENDIENTES/PRIMA de `OFERTA AM`. */
function PricingTablePage({ data }: { data: CaratulaAMData }) {
  const labels = memberLabels(data.members);
  const deltaLogo = fitLogo(DELTA_LOGO_ASPECT, 32, 32);
  return (
    <Page size="A4" orientation="landscape" style={tableStyles.page}>
      <View style={tableStyles.topRow}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- <Image> acá es el componente de @react-pdf/renderer (PDF, no DOM); no tiene prop `alt`. */}
        <Image src={DELTA_LOGO} style={deltaLogo} />
        <View>
          <Text style={{ fontSize: 11, fontWeight: 700, color: "#152a52" }}>Comparativa de primas — {data.clientName}</Text>
          <Text style={{ fontSize: 8, color: "#6b6f76", marginTop: 2 }}>Grupo: {labels.join(" · ")}</Text>
        </View>
      </View>
      <View style={tableStyles.table}>
        <OfferTableHeader data={data} />
        {labels.map((label, m) => (
          <View style={tableStyles.row} key={label}>
            <Text style={tableStyles.labelCell}>{label}</Text>
            {data.offers.map((o, i) => (
              <Text key={i} style={tableStyles.dataCell}>
                {o.memberPremiumsCents[m] != null ? formatUSD(o.memberPremiumsCents[m]) : ""}
              </Text>
            ))}
          </View>
        ))}
        <View style={tableStyles.row}>
          <Text style={tableStyles.labelCell}>Prima neta</Text>
          {data.offers.map((o, i) => (
            <Text key={i} style={tableStyles.dataCell}>
              {formatUSD(o.netPremiumCents)}
            </Text>
          ))}
        </View>
        <View style={tableStyles.row}>
          <Text style={tableStyles.labelCell}>Otros cargos</Text>
          {data.offers.map((o, i) => (
            <Text key={i} style={tableStyles.dataCell}>
              {formatUSD(o.emissionFeeCents)}
            </Text>
          ))}
        </View>
        <View style={tableStyles.row}>
          <Text style={tableStyles.labelCell}>Subtotal</Text>
          {data.offers.map((o, i) => (
            <Text key={i} style={tableStyles.dataCell}>
              {formatUSD(o.netPremiumCents + o.emissionFeeCents)}
            </Text>
          ))}
        </View>
        <View style={tableStyles.row}>
          <Text style={tableStyles.labelCell}>0.50% Seguro Campesino</Text>
          {data.offers.map((o, i) => (
            <Text key={i} style={tableStyles.dataCell}>
              {formatUSD(o.campesinoCents)}
            </Text>
          ))}
        </View>
        <View style={tableStyles.totalsRow}>
          <Text style={tableStyles.totalsLabelCell}>PRIMA TOTAL</Text>
          {data.offers.map((o, i) => (
            <Text key={i} style={tableStyles.totalsDataCell}>
              {formatUSD(o.totalPremiumCents)}
            </Text>
          ))}
        </View>
        <View style={tableStyles.amberRow}>
          <Text style={tableStyles.amberLabelCell}>Total sin descuento</Text>
          {data.offers.map((o, i) => (
            <Text key={i} style={tableStyles.amberDataCell}>
              {formatUSD(o.sinDescuentoCents)}
            </Text>
          ))}
        </View>
        <View style={tableStyles.amberRow}>
          <Text style={tableStyles.amberLabelCell}>Total con descuento especial</Text>
          {data.offers.map((o, i) => (
            <Text key={i} style={tableStyles.amberDataCell}>
              {o.conDescuentoEspecialCents != null ? formatUSD(o.conDescuentoEspecialCents) : "N/A"}
            </Text>
          ))}
        </View>
        <View style={tableStyles.amberRow}>
          <Text style={tableStyles.amberLabelCell}>Total con descuento de contado</Text>
          {data.offers.map((o, i) => (
            <Text key={i} style={tableStyles.amberDataCell}>
              {o.conDescuentoContadoCents != null ? formatUSD(o.conDescuentoContadoCents) : "N/A"}
            </Text>
          ))}
        </View>
        <View style={tableStyles.row}>
          <Text style={tableStyles.labelCell}>Efectivo o transferencia</Text>
          {data.offers.map((o, i) => (
            <Text key={i} style={tableStyles.dataCell}>
              {formatUSD(o.totalPremiumCents)}
            </Text>
          ))}
        </View>
        {INSTALLMENT_TERMS.map((n) => (
          <View style={tableStyles.row} key={n}>
            <Text style={tableStyles.labelCell}>Tarjeta {n} meses</Text>
            {data.offers.map((o, i) => (
              <Text key={i} style={tableStyles.dataCell}>
                {formatUSD(Math.round(o.totalPremiumCents / n))}
              </Text>
            ))}
          </View>
        ))}
      </View>
      <AMTablePageFooter />
    </Page>
  );
}

/** IMPRIMIR_OFERTA_AM: PORTADA, CARATULA AM y OFERTA AM (coberturas y primas de los planes marcados). */
export function CaratulaAMDocument({ data }: { data: CaratulaAMData }) {
  return (
    <Document title={`Oferta ${data.quoteCode}`}>
      <PortadaAMPage data={data} />
      <CaratulaAMLetterPage data={data} />
      <CoverageGridPage data={data} />
      <PricingTablePage data={data} />
    </Document>
  );
}
