import { listVehicleBrands } from "@/actions/catalog.actions";
import { NuevaCotizacionForm } from "@/components/quoting/NuevaCotizacionForm";

export default async function NuevaCotizacionAutosPage() {
  const brands = await listVehicleBrands();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Nueva cotización — Autos</h1>
        <p className="mt-1 text-sm text-muted">
          Reemplaza la hoja &quot;DATOS VH&quot; del Excel — un solo formulario, sin
          copiar entre hojas.
        </p>
      </header>
      <NuevaCotizacionForm brands={brands.map((b) => b.name)} />
    </main>
  );
}
