import {
  listAutoInsurers,
  listQuoteExecutives,
  listQuoteSources,
  listVehicleBrands,
  listVehicleModelsByBrand,
} from "@/actions/catalog.actions";
import { NuevaCotizacionForm } from "@/components/quoting/NuevaCotizacionForm";

export default async function NuevaCotizacionAutosPage() {
  const [brands, modelsByBrand, sources, executives, insurers] = await Promise.all([
    listVehicleBrands(),
    listVehicleModelsByBrand(),
    listQuoteSources(),
    listQuoteExecutives("AUTOS"),
    listAutoInsurers(),
  ]);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Nueva cotización — Autos</h1>
      </header>
      <NuevaCotizacionForm
        brands={brands.map((b) => b.name)}
        modelsByBrand={modelsByBrand}
        sources={sources.map((s) => s.name)}
        executives={executives.map((e) => e.name)}
        insurers={insurers}
      />
    </main>
  );
}
