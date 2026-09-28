import { listQuoteSources } from "@/actions/catalog.actions";
import { NuevaCotizacionSaludForm } from "@/components/quoting/NuevaCotizacionSaludForm";

export default async function NuevaCotizacionSaludPage() {
  const sources = await listQuoteSources();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Nueva cotización — Salud</h1>
        <p className="mt-1 text-sm text-muted">
          Titular + hasta 3 dependientes. BMI y Humana calculan la prima real por
          edad/sexo/región; el resto queda pendiente de digitar.
        </p>
      </header>
      <NuevaCotizacionSaludForm sources={sources.map((s) => s.name)} />
    </main>
  );
}
