import { notFound } from "next/navigation";
import { getMyProfile } from "@/actions/user.actions";
import { ROLE_LABELS, type AssignableRole } from "@/domains/identity/schemas/user.schema";
import { UpdateNameForm } from "@/components/auth/UpdateNameForm";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";

/** "Perfil" — nombre, correo, rol y clave de quien está logueado (pedido del usuario, link nuevo en el menú de la cuenta). */
export default async function PerfilPage() {
  const profile = await getMyProfile();
  if (!profile) notFound();

  const roleLabel = profile.roleCode ? (ROLE_LABELS[profile.roleCode as AssignableRole] ?? profile.roleCode) : "—";

  return (
    <main className="mx-auto max-w-2xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Perfil</h1>
        <p className="mt-1 text-sm text-muted">Tus datos de cuenta en Cotizador Delta Seguros.</p>
      </header>

      <section className="mb-8 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <dl className="mb-4 flex flex-col gap-1 text-sm">
          <div className="flex gap-2">
            <dt className="font-semibold text-muted">Correo:</dt>
            <dd>{profile.email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-semibold text-muted">Rol:</dt>
            <dd>{roleLabel}</dd>
          </div>
        </dl>
        <UpdateNameForm fullName={profile.fullName ?? ""} />
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Cambiar clave</h2>
        <ChangePasswordForm />
      </section>
    </main>
  );
}
