import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CaratulaData } from "../services/caratula.service";
import { formatUSD } from "@/domains/shared/money";

/**
 * Equivalente a la hoja `CARATULA` del Excel (EXCEL-AUDIT.md) — el texto de
 * coberturas, cláusulas adicionales y aclaratorio es el mismo texto real que
 * ya usa Delta (extraído celda por celda), no se redactó de nuevo.
 */
const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10.5, fontFamily: "Helvetica", color: "#182338", lineHeight: 1.5 },
  brand: { fontSize: 16, fontWeight: 700, color: "#152a52", marginBottom: 2 },
  brandSub: { fontSize: 8.5, color: "#6b6f76", marginBottom: 24 },
  date: { textAlign: "right", marginBottom: 16, color: "#6b6f76" },
  h2: { fontSize: 11, fontWeight: 700, color: "#152a52", marginTop: 16, marginBottom: 6 },
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
  bullet: { flexDirection: "row", marginBottom: 4 },
  bulletMark: { width: 10 },
  bulletText: { flex: 1 },
  footer: { marginTop: 28, color: "#6b6f76" },
});

export function CaratulaDocument({ data }: { data: CaratulaData }) {
  return (
    <Document title={`Oferta ${data.quoteCode}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>DELTA SEGUROS</Text>
        <Text style={styles.brandSub}>Cía. Ltda.</Text>
        <Text style={styles.date}>Quito, {data.date}</Text>

        <Text>Señores</Text>
        <Text style={{ marginBottom: 4 }}>{data.clientName}</Text>
        <Text style={{ marginBottom: 12 }}>Presente.-</Text>

        <Text style={{ marginBottom: 12 }}>
          REFERENCIA: Póliza de Vehículos — {data.vehicleLabel} (placa {data.vehiclePlate})
        </Text>

        <Text style={{ marginBottom: 12 }}>
          De nuestra consideración: nos permitimos poner en su consideración nuestra mejor oferta
          del mercado ecuatoriano para la cobertura del vehículo de su propiedad.
        </Text>

        <Text style={styles.h2}>OBJETO ASEGURADO</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Vehículo</Text>
          <Text style={styles.value}>{data.vehicleLabel}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Valor asegurado</Text>
          <Text style={styles.value}>{formatUSD(data.insuredValueCents)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Valor extras</Text>
          <Text style={styles.value}>
            {data.extrasValueCents > 0 ? formatUSD(data.extrasValueCents) : "Sin extras"}
          </Text>
        </View>

        <Text style={styles.h2}>ASEGURADORA RECOMENDADA — {data.insurerName}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Prima neta</Text>
          <Text style={styles.value}>{formatUSD(data.netPremiumCents)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>3.50% Superintendencia de Bancos</Text>
          <Text style={styles.value}>{formatUSD(data.superBancosCents)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>0.50% Seguro Campesino</Text>
          <Text style={styles.value}>{formatUSD(data.campesinoCents)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Derechos de emisión</Text>
          <Text style={styles.value}>{formatUSD(data.emissionFeeCents)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>15% IVA</Text>
          <Text style={styles.value}>{formatUSD(data.ivaCents)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>PRIMA TOTAL</Text>
          <Text style={styles.totalValue}>{formatUSD(data.totalPremiumCents)}</Text>
        </View>

        <Text style={styles.h2}>COBERTURAS</Text>
        <Text>
          Choque y/o volcadura, incendio y/o rayo, explosión, robo total y parcial, hurto, daños
          maliciosos y/o vandalismo, motín, huelga, fenómenos de la naturaleza, rotura de vidrios,
          autoignición, tránsito por caminos no entregados oficialmente al uso público, paso por
          puentes y gabarras, caída de edificios o de objetos que caigan de ellos, derrumbes,
          explosión, rotura de vidrios, impacto de proyectiles, caída de árboles, deslaves, caídas
          de rocas, aludes, responsabilidad civil, gastos de remolque, impacto con objetos sólidos,
          caída de aeronaves o partes de ellas.
        </Text>

        <Text style={styles.h2}>CLÁUSULAS ADICIONALES</Text>
        {[
          "Restitución automática de suma asegurada",
          "Aviso de siniestro 10 días hábiles",
          "Cancelación de la póliza 30 días",
          "Pago de primas 15 días",
        ].map((clause) => (
          <View style={styles.bullet} key={clause}>
            <Text style={styles.bulletMark}>·</Text>
            <Text style={styles.bulletText}>{clause}</Text>
          </View>
        ))}

        <Text style={styles.h2}>ACLARATORIO</Text>
        {[
          "El valor asegurado corresponderá al valor real comercial del mercado con una tolerancia de 10% +/-.",
          "En el caso de que el vehículo tenga accesorios no originales, serán considerados como extras y deberán detallarse en la póliza con su valor asegurado. Es obligación del asegurado indicar los accesorios que tenga el vehículo antes de la emisión de la póliza.",
          "Este documento no es una póliza de seguros, ni otorga cobertura al vehículo cotizado. El pago de la póliza debe hacerse por los canales autorizados por las compañías de seguros.",
          "En caso de pérdida total, el valor a indemnizar será el valor comercial a la fecha del siniestro, descontando el deducible de pérdida total establecido por la aseguradora.",
        ].map((note) => (
          <View style={styles.bullet} key={note}>
            <Text style={styles.bulletMark}>·</Text>
            <Text style={styles.bulletText}>{note}</Text>
          </View>
        ))}

        <Text style={styles.footer}>
          Por la favorable atención que se sirva dar a la presente, anticipo mis agradecimientos.
        </Text>
        <Text style={styles.footer}>Cordialmente,</Text>
        <Text style={{ marginTop: 16, fontWeight: 700, color: "#152a52" }}>
          DELTASEGUROS CÍA. LTDA.
        </Text>
      </Page>
    </Document>
  );
}
