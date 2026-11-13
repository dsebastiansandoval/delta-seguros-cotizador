import {
  listAutoInsurers,
  listQuoteSources,
  listQuoteVendors,
  listVehicleBrands,
  listVehicleModelsByBrand,
} from "@/actions/catalog.actions";
import { getAccess, vendorMode } from "@/domains/identity/services/rbac.service";
import { NuevaCotizacionForm } from "@/components/quoting/NuevaCotizacionForm";

export default async function NuevaCotizacionAutosPage() {
  const [session, brands, modelsByBrand, sources, vendors, insurers] = await Promise.all([
    getAccess(),
    listVehicleBrands(),
    listVehicleModelsByBrand(),
    listQuoteSources(),
    listQuoteVendors("AUTOS"),
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
        vendors={vendors}
        currentVendor={session?.fullName ?? ""}
        vendorMode={session ? vendorMode(session) : "locked"}
        insurers={insurers}
      />
    </main>
  );
}
