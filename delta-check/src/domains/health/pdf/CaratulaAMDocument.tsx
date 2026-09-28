import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Document, Image, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CaratulaAMData, CaratulaAMMember, CaratulaAMOffer } from "../services/caratula-am.service";
import { formatUSD } from "@/domains/shared/money";

/**
 * Portada real de Salud/AM (`xl/media/image60.jpeg` dentro de COTIZADOR
 * DELTA-1.xlsm — misma familia de diseño que la portada de Autos, "Tu
 * salud es nuestra prioridad"). 1710×2419px a 220dpi → 560×792pt.
 */
const PORTADA_SALUD = readFileSync(join(process.cwd(), "src/domains/quoting/pdf/assets/portada-salud.jpg"));
const PORTADA_SIZE: [number, number] = [560, 792];

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
  page: { padding: 42, fontSize: 10.5, fontFamily: "Helvetica", color: "#182338", lineHeight: 1.4 },
  brand: { fontSize: 16, fontWeight: 700, color: "#152a52", marginBottom: 2 },
  brandSub: { fontSize: 8.5, color: "#6b6f76", marginBottom: 16 },
  date: { textAlign: "right", marginBottom: 12, color: "#6b6f76" },
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

const INSTALLMENT_TERMS = [6, 9, 12] as const;

const REGION_LABEL: Record<CaratulaAMData["region"], string> = {
  SIERRA: "Sierra",
  COSTA: "Costa",
  AUSTRO: "Austro",
};

/** Etiqueta "Titular"/"Dependiente N" para cada miembro — se numeran los dependientes antes de renderizar, no mutando una variable dentro del `.map()`. */
function memberLabels(members: CaratulaAMMember[]): string[] {
  let depIndex = 0;
  return members.map((m) => {
    const relation = m.relation === "TITULAR" ? "Titular" : `Dependiente ${(depIndex += 1)}`;
    return `${relation} — ${m.age} años, ${m.gender === "MASCULINO" ? "masculino" : "femenino"}`;
  });
}

function CaratulaAMPage({ data, offer, isComparison }: { data: CaratulaAMData; offer: CaratulaAMOffer; isComparison: boolean }) {
  const labels = memberLabels(data.members);
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.brand}>DELTA SEGUROS</Text>
      <Text style={styles.brandSub}>Cía. Ltda.</Text>
      <Text style={styles.date}>Quito, {data.date}</Text>

      <Text>Señores</Text>
      <Text style={{ marginBottom: 4 }}>{data.clientName}</Text>
      <Text style={{ marginBottom: 8 }}>Presente.-</Text>

      <Text style={{ marginBottom: 8 }}>REFERENCIA: Cotización Seguro Médico — {REGION_LABEL[data.region]}</Text>

      <Text style={{ marginBottom: 8 }}>
        <Text style={{ fontWeight: 700 }}>De nuestra consideración: </Text>
        {isComparison
          ? "nos permitimos poner en su consideración las siguientes opciones de seguro médico cotizadas en el mercado ecuatoriano, para que usted elija la que mejor se ajuste a las necesidades de su grupo familiar."
          : "nos permitimos poner en su consideración nuestra mejor oferta de seguro médico del mercado ecuatoriano para usted y su grupo familiar."}
      </Text>

      <Text style={styles.h2}>GRUPO ASEGURADO</Text>
      {labels.map((label, i) => (
        <View style={styles.row} key={i}>
          <Text style={styles.label}>{label}</Text>
        </View>
      ))}

      <Text style={styles.h2}>{isComparison ? `ASEGURADORA — ${offer.insurerName}` : `ASEGURADORA RECOMENDADA — ${offer.insurerName}`}</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Plan</Text>
        <Text style={styles.value}>{offer.planCode}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Prima neta (grupo)</Text>
        <Text style={styles.value}>{formatUSD(offer.netPremiumCents)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Otros cargos</Text>
        <Text style={styles.value}>{formatUSD(offer.emissionFeeCents)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>0.50% Seguro Campesino</Text>
        <Text style={styles.value}>{formatUSD(offer.campesinoCents)}</Text>
      </View>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>PRIMA TOTAL</Text>
        <Text style={styles.totalValue}>{formatUSD(offer.totalPremiumCents)}</Text>
      </View>

      <Text style={styles.h2}>FORMAS DE PAGO</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Efectivo o transferencia</Text>
        <Text style={styles.value}>{formatUSD(offer.totalPremiumCents)}</Text>
      </View>
      <Text style={[styles.label, { marginTop: 6, marginBottom: 2 }]}>Tarjeta de crédito, sin interés</Text>
      <View style={styles.paymentRow}>
        {INSTALLMENT_TERMS.map((n) => (
          <View style={styles.paymentCol} key={n}>
            <Text style={styles.paymentTerm}>{n} meses</Text>
            <Text style={styles.paymentValue}>{formatUSD(Math.round(offer.totalPremiumCents / n))}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.h2}>ACLARATORIO</Text>
      <Text>
        Este documento no es una póliza de seguros, ni otorga cobertura médica. El pago de la póliza debe
        hacerse por los canales autorizados por las compañías de seguros. Las coberturas, copagos,
        sublímites y períodos de carencia específicos de cada plan se detallan en las condiciones
        particulares que entrega la aseguradora al momento de la emisión.
      </Text>

      <Text style={styles.footer}>
        Por la favorable atención que se sirva dar a la presente, anticipo mis agradecimientos.
      </Text>
      <Text style={styles.footer}>Cordialmente,</Text>
      <Text style={{ marginTop: 10, fontWeight: 700, color: "#152a52" }}>DELTASEGUROS CÍA. LTDA.</Text>
    </Page>
  );
}

export function CaratulaAMDocument({ data }: { data: CaratulaAMData }) {
  const isComparison = data.offers.length > 1;
  return (
    <Document title={`Oferta ${data.quoteCode}`}>
      <PortadaAMPage data={data} />
      {data.offers.map((offer, i) => (
        <CaratulaAMPage key={`${offer.insurerName}-${offer.planCode}-${i}`} data={data} offer={offer} isComparison={isComparison} />
      ))}
    </Document>
  );
}
