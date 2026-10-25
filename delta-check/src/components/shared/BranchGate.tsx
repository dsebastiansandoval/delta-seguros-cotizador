import { getAccess, type Branch } from "@/domains/identity/services/rbac.service";

const LABEL: Record<Branch, string> = { AUTOS: "Autos", SALUD: "Salud AM" };

/** Cubre todas las páginas de un ramo; las acciones vuelven a validar con requireBranch. */
export async function BranchGate({ branch, children }: { branch: Branch; children: React.ReactNode }) {
  const access = await getAccess();
  if (access?.branches.has(branch)) return children;

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-xl font-bold tracking-tight">Sin acceso a {LABEL[branch]}</h1>
      <p className="mt-2 text-sm text-muted">
        Tu usuario no tiene habilitado este ramo. Pídele a un administrador que lo active en Administración → Usuarios.
      </p>
    </main>
  );
}
