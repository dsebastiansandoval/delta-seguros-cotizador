import { getSettingsOverview } from "@/actions/settings.actions";
import { EngineRatesEditor } from "@/components/admin/EngineRatesEditor";
import { FormListEditor } from "@/components/admin/FormListEditor";
import { getAccess } from "@/domains/identity/services/rbac.service";

/**
 * Lo que en el Excel se cambiaba a mano en INFO GENERAL: la lista de FUENTE
 * (user:manage) y las tablas de tasas de Latina y Cóndor (rate:edit). El
 * campo EJECUTIVO ya no se edita acá — sale de los usuarios del sistema
 * (Administración → Usuarios), a pedido de Delta. Los impuestos y derechos
 * de emisión no están acá: son ley, no configuración (premium.calculator.ts).
 */
export default async function ConfiguracionPage() {
  const access = await getAccess();
  if (!access?.permissions.has("user:manage") && !access?.permissions.has("rate:edit")) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-xl font-bold tracking-tight">Sin acceso</h1>
        <p className="mt-2 text-sm text-muted">Solo un administrador puede cambiar la configuración.</p>
      </main>
    );
  }

  const { lists, engineRates } = await getSettingsOverview();

  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Configuración</h1>
        <p className="mt-1 text-sm text-muted">
          Lo que en el Excel se cambiaba a mano en INFO GENERAL. Las tarifas de Salud se cargan en{" "}
          <a href="/admin/tarifas-salud" className="text-link hover:underline">
            Tarifas Salud
          </a>
          .
        </p>
      </header>

      {lists && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Listas del formulario</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <FormListEditor
              kind="sources"
              title="Fuentes"
              hint="Campo FUENTE: quién trajo al cliente."
              items={lists.sources}
            />
          </div>
          <p className="mt-3 text-xs text-muted">
            El campo EJECUTIVO sale de los usuarios activos del sistema —{" "}
            <a href="/admin/usuarios" className="text-link hover:underline">
              administrar en Usuarios
            </a>
            .
          </p>
        </section>
      )}

      {engineRates && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Tasas Autos con cálculo automático
          </h2>
          <EngineRatesEditor {...engineRates} />
        </section>
      )}
    </main>
  );
}
