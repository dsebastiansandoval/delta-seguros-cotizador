import { getHealthRateOverview } from "@/actions/health-rate.actions";
import { HealthRateUploadForm } from "@/components/admin/HealthRateUploadForm";
import { HEALTH_RATE_CSV_HEADER } from "@/domains/health/services/health-rate-csv";
import { todayInEcuador } from "@/domains/health/services/health-rate-admin.service";
import { getAccess } from "@/domains/identity/services/rbac.service";

function TableLink({ table }: { table: { id: string; validFrom: string; rules: number } }) {
  return (
    <a href={`/api/admin/tarifas-salud/${table.id}`} className="text-link hover:underline">
      {table.validFrom} · {table.rules.toLocaleString("es-EC")} tarifas · CSV
    </a>
  );
}

/** Carga de tarifas de Salud por aseguradora — solo ADMIN (rate:edit). Reemplaza npm run db:seed:salud. */
export default async function TarifasSaludPage() {
  const access = await getAccess();
  if (!access?.permissions.has("rate:edit")) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-xl font-bold tracking-tight">Sin acceso</h1>
        <p className="mt-2 text-sm text-muted">Solo un administrador puede cargar tarifas.</p>
      </main>
    );
  }

  const overview = await getHealthRateOverview();
  // Las aseguradoras sin planes tarifados (BUPA: prima manual) no tienen nada que cargar.
  const uploadable = overview.filter((i) => i.ratedPlanCodes.length > 0);

  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Tarifas Salud AM</h1>
        <p className="mt-1 text-sm text-muted">
          Cuando una aseguradora actualiza su tabla: descarga el CSV vigente, cambia las primas en Excel, guárdalo como
          CSV y súbelo con la fecha desde la que rige. Si la fecha es futura, se sigue cotizando con la tabla actual
          hasta ese día.
        </p>
      </header>

      <section className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Cargar tabla</h2>
        <HealthRateUploadForm
          today={todayInEcuador()}
          insurers={uploadable.map((i) => ({
            id: i.id,
            name: i.name,
            ratedPlanCodes: i.ratedPlanCodes,
            currentPlanCodes: i.current?.plans ?? [],
          }))}
        />
        <p className="mt-4 text-xs text-muted">
          Columnas: <code>{HEALTH_RATE_CSV_HEADER.join(", ")}</code>. <code>relacion</code> TITULAR o DEPENDIENTE,{" "}
          <code>sexo</code> MASCULINO o FEMENINO, <code>region</code> COSTA, SIERRA o AUSTRO; vacío significa que aplica a
          cualquiera. <code>edad_hasta</code> 999 es &quot;en adelante&quot;. Se acepta separador coma o punto y coma, y coma decimal.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Aseguradora</th>
              <th className="px-5 py-3 font-semibold">Vigente</th>
              <th className="px-5 py-3 font-semibold">Planes</th>
              <th className="px-5 py-3 font-semibold">Programada</th>
              <th className="px-5 py-3 font-semibold">Anteriores</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {overview.map((insurer) => (
              <tr key={insurer.id} className="align-top">
                <td className="px-5 py-3 font-semibold">{insurer.name}</td>
                <td className="px-5 py-3">
                  {insurer.current ? (
                    <TableLink table={insurer.current} />
                  ) : (
                    <span className="text-muted">
                      {insurer.ratedPlanCodes.length ? "Sin tabla — no cotiza" : "Prima manual en la cotización"}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-muted">
                  {insurer.current ? `${insurer.current.plans.length} de ${insurer.ratedPlanCodes.length}` : "—"}
                </td>
                <td className="px-5 py-3">
                  {insurer.scheduled.length
                    ? insurer.scheduled.map((t) => (
                        <div key={t.id}>
                          <TableLink table={t} />
                        </div>
                      ))
                    : <span className="text-muted">—</span>}
                </td>
                <td className="px-5 py-3">
                  {insurer.history.length
                    ? insurer.history.map((t) => (
                        <div key={t.id}>
                          <TableLink table={t} />
                        </div>
                      ))
                    : <span className="text-muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
