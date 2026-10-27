import { listUsers } from "@/actions/user.actions";
import { CreateUserForm, UserRow } from "@/components/admin/UserForms";
import { getAccess } from "@/domains/identity/services/rbac.service";

/** ABM de usuarios de la organización — solo ADMIN (user:manage), ARCHITECTURE.md §8.4. */
export default async function UsuariosPage() {
  const access = await getAccess();
  if (!access?.permissions.has("user:manage")) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-xl font-bold tracking-tight">Sin acceso</h1>
        <p className="mt-2 text-sm text-muted">Solo un administrador puede gestionar usuarios.</p>
      </main>
    );
  }

  const users = await listUsers();

  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Usuarios</h1>
        <p className="mt-1 text-sm text-muted">
          Quién entra a Cotizador Delta Seguros, con qué rol y qué ramos ve. La persona ingresa con su cuenta de Microsoft del
          mismo correo; no hay contraseñas. Un usuario no se borra: se desactiva y conserva su historial.
        </p>
      </header>

      <section className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Nuevo usuario</h2>
        <CreateUserForm />
      </section>

      <section className="rounded-xl border border-border bg-surface shadow-sm">
        <h2 className="border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
          {users.length} usuarios
        </h2>
        <ul className="divide-y divide-border">
          {users.map((user) => (
            <UserRow key={user.id} user={user} isSelf={user.id === access.userId} />
          ))}
        </ul>
      </section>

      <dl className="mt-6 grid grid-cols-1 gap-2 text-xs text-muted sm:grid-cols-2">
        <div><dt className="inline font-semibold">Administrador:</dt> <dd className="inline">todo, incluida esta pantalla.</dd></div>
        <div><dt className="inline font-semibold">Supervisor:</dt> <dd className="inline">cartera, comisiones y dashboard de todos los agentes.</dd></div>
        <div><dt className="inline font-semibold">Agente:</dt> <dd className="inline">cotiza y gestiona sus clientes y comisiones.</dd></div>
        <div><dt className="inline font-semibold">Lector:</dt> <dd className="inline">solo lectura.</dd></div>
      </dl>
    </main>
  );
}
