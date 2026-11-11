import { getDeductibleProfiles } from "@/actions/deductible.actions";
import { DeductibleProfileForm } from "@/components/admin/DeductibleProfileForm";
import { getAccess } from "@/domains/identity/services/rbac.service";

/** Deducibles de Autos editables por aseguradora — reunión 6-nov, Workstream D. Solo ADMIN (rate:edit). */
export default async function DeduciblesPage() {
  const access = await getAccess();
  if (!access?.permissions.has("rate:edit")) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-xl font-bold tracking-tight">Sin acceso</h1>
        <p className="mt-2 text-sm text-muted">Solo un administrador puede editar deducibles.</p>
      </main>
    );
  }

  const profiles = await getDeductibleProfiles();

  return (
    <main className="mx-auto max-w-4xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Deducibles de Autos</h1>
        <p className="mt-1 text-sm text-muted">
          El deducible parcial y de pérdida total que se precarga al configurar la oferta de cada aseguradora, y el
          menú de opciones que el asesor puede elegir. El resto de coberturas de Autos (RC, gastos médicos,
          asistencia mecánica…) no se edita aquí.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {profiles.map((profile) => (
          <DeductibleProfileForm key={profile.insurerId} profile={profile} />
        ))}
      </div>
    </main>
  );
}
