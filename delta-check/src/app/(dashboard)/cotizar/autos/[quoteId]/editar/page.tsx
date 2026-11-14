import { notFound } from "next/navigation";
import { listAutoInsurers, listQuoteVendors, listVehicleBrands, listVehicleModelsByBrand } from "@/actions/catalog.actions";
import { getAutoQuoteForEdit } from "@/actions/quote.actions";
import { getAccess, vendorMode } from "@/domains/identity/services/rbac.service";
import { NuevaCotizacionForm } from "@/components/quoting/NuevaCotizacionForm";

/**
 * Corrige cliente + vehículo(s) de una cotización BORRADOR ya creada — ver
 * getAutoQuoteForEdit/updateAutoQuote en quote.actions.ts. Antes de esto no
 * había forma de volver a los datos ya guardados: "Atrás" en el navegador
 * solo llevaba a /nueva en blanco.
 */
export default async function EditarCotizacionAutosPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;

  const [session, edit, brands, modelsByBrand, vendors, insurers] = await Promise.all([
    getAccess(),
    getAutoQuoteForEdit(quoteId),
    listVehicleBrands(),
    listVehicleModelsByBrand(),
    listQuoteVendors("AUTOS"),
    listAutoInsurers(),
  ]);

  if (!edit) notFound();

  if (edit.locked) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-xl font-bold tracking-tight">No se puede editar</h1>
        <p className="mt-2 text-sm text-muted">
          Esta cotización ya no está en borrador — una vez enviada, sus datos quedan fijos.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Editar cotización — {edit.quoteCode}</h1>
        <p className="mt-1 text-sm text-muted">Corrige los datos del cliente o del vehículo. No cambia el número de riesgos.</p>
      </header>
      <NuevaCotizacionForm
        brands={brands.map((b) => b.name)}
        modelsByBrand={modelsByBrand}
        vendors={vendors}
        currentVendor={session?.fullName ?? ""}
        vendorMode={session ? vendorMode(session) : "locked"}
        insurers={insurers}
        editQuote={edit}
      />
    </main>
  );
}
