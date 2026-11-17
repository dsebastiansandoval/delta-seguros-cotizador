import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integración API — Cotizador Delta Seguros",
  description: "Especificación de integración API para aseguradoras — Cotizador Delta Seguros",
};

/**
 * Página pública (ver PUBLIC_PATHS en proxy.ts) — se comparte directo con
 * el equipo técnico de cada aseguradora en las reuniones de integración
 * (pedido del usuario, reunión Equisuiza/AIG/Atlántida nov-2026), sin que
 * necesiten una cuenta en el Cotizador. Es contenido fijo (no lee de la
 * base) a propósito: lo que se negocia en la reunión es justo si la
 * aseguradora puede cumplir esto, no al revés.
 */

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-8 first:border-0 first:pt-0">
      <h2 className="flex items-baseline gap-3 text-lg font-bold tracking-tight">
        <span className="text-muted">{n}</span>
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function FieldTable({ rows }: { rows: Array<{ campo: string; detalle: string }> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.campo} className={i !== rows.length - 1 ? "border-b border-border" : ""}>
              <td className="w-56 shrink-0 bg-surface px-4 py-2.5 align-top font-semibold">{r.campo}</td>
              <td className="px-4 py-2.5 align-top text-muted">{r.detalle}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span aria-hidden className="mt-0.5 h-4 w-4 shrink-0 rounded border border-border" />
      <span>{children}</span>
    </li>
  );
}

export default function IntegracionesPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo chico y fijo, mismo patrón que login/page.tsx */}
        <img src="/delta-logo.png" alt="Delta Seguros" className="mb-6 h-10 w-auto rounded-lg bg-white p-1.5" />
        <h1 className="text-2xl font-bold tracking-tight">Integración API — Cotizador Delta Seguros</h1>
        <p className="mt-2 text-sm text-muted">
          Especificación de lo que necesitamos de la API de su aseguradora para integrarla al Cotizador de Delta
          Seguros. Documento vivo — no todas las secciones aplican igual a todas las aseguradoras; la idea es
          marcar qué existe hoy y qué no, para definir el alcance real.
        </p>
      </header>

      <div className="flex flex-col gap-10">
        <Section n="0." title="Qué buscamos">
          <p>
            Hoy el Cotizador calcula la prima de la mayoría de aseguradoras con tasas digitadas a mano por nuestro
            equipo. El objetivo de esta integración es que, para su aseguradora, la cotización salga directo de su
            sistema en tiempo real — más rápido para el cliente final y sin margen de error de digitación de
            nuestro lado. Emisión, seguimiento de póliza y comisiones quedan fuera de este alcance por ahora — a
            futuro se resuelven con la integración a SoftSeguros, no aquí.
          </p>
        </Section>

        <Section n="1." title="Cotización (rating)">
          <p>Terminos para reemplazar la tasa manual por una llamada API a su sistema.</p>
          <p className="font-semibold">Lo disponible para ENVIO</p>
          <FieldTable
            rows={[
              { campo: "Vehículo", detalle: "Marca, modelo, año, valor comercial, ciudad, si tiene rastreo satelital" },
              { campo: "Modalidad", detalle: "Anual o por kilómetro (Auto x Km)" },
              { campo: "Cliente", detalle: "Tipo de persona, cédula/RUC, para Salud también edad y género" },
              { campo: "Renovación", detalle: "Si aplica: aseguradora anterior, póliza anterior, prima anterior" },
            ]}
          />
          <p className="font-semibold">Lo que necesitamos de vuelta</p>
          <FieldTable
            rows={[
              { campo: "Prima neta", detalle: "Antes de cargos — es la base de toda la comparativa" },
              { campo: "Cargos por separado", detalle: "Derecho de emisión, Superintendencia de Bancos y Seguro Campesino — para armar el desglose igual que con Latina y Cóndor hoy" },
              { campo: "IVA", detalle: "Si ya viene incluido en algún monto o si lo calculamos nosotros" },
              { campo: "Deducibles disponibles", detalle: "Con sus montos — hoy lo mantiene a mano nuestro equipo, necesitamos que venga dinámico de ustedes" },
              { campo: "Coberturas del plan", detalle: "RC, AP, GM, auto sustituto, amparo patrimonial, entre otras — cuáles incluye cada plan ofrecido" },
            ]}
          />
        </Section>

        <Section n="2." title="Especificaciones técnicas">
          <FieldTable
            rows={[
              { campo: "Autenticación", detalle: "API key, OAuth, certificado — y si hay un ambiente de pruebas (sandbox) separado de producción" },
              { campo: "Formato", detalle: "REST/JSON (ideal) o SOAP/XML" },
              { campo: "Documentación", detalle: "Swagger/Postman/colección de pruebas — no solo un PDF descriptivo" },
              { campo: "Costo por transacción", detalle: "Si cobran por consulta/cotización, y si hay límite de uso (rate limit)" },
              { campo: "Soporte", detalle: "Tiempo de respuesta esperado y contacto técnico si la integración falla" },
            ]}
          />
        </Section>

        <Section n="3." title="Checklist rápido">
          <p className="text-muted">Para marcar en la reunión qué existe hoy de su lado:</p>
          <ul className="flex flex-col gap-2.5">
            <Check>Cotización (prima + desglose) por API</Check>
            <Check>Deducibles y coberturas dinámicos (no fijos)</Check>
            <Check>Ambiente de pruebas (sandbox) disponible</Check>
            <Check>Documentación técnica (Swagger/Postman)</Check>
          </ul>
        </Section>
      </div>

      <footer className="mt-12 border-t border-border pt-6 text-xs text-muted">
        Cotizador Delta Seguros — contacto: equipo técnico Delta Seguros.
      </footer>
    </main>
  );
}
