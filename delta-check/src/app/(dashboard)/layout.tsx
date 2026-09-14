import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSession, signOut } from "@/lib/auth";
import { AccountMenu } from "@/components/shared/AccountMenu";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cotizar/autos/nueva", label: "Cotizar Autos" },
  { href: "/cotizar/salud/nueva", label: "Cotizar Salud" },
  { href: "/cartera", label: "Cartera" },
  { href: "/comisiones", label: "Comisiones" },
  { href: "/siniestros", label: "Siniestros" },
  { href: "/cumplimiento", label: "Cumplimiento" },
];

/**
 * Shell de navegación para todas las páginas autenticadas — hasta ahora
 * cada página vivía sola, sin ningún link a las demás (se llegaba
 * escribiendo la URL a mano). El guard de sesión también vivía solo
 * implícito en cada Server Action (`requirePermission()` lanza
 * `UnauthenticatedError`) — acá se hace explícito una vez, con un
 * redirect a /login en vez de una página de error cruda si alguien
 * navega directo sin sesión.
 */
export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const session = await getAppSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-8 py-3">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-bold tracking-tight">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-delta-navy font-mono text-xs font-bold text-white">
              DC
            </span>
            Delta Check
          </Link>

          <nav className="ml-auto flex flex-wrap items-center gap-1 text-sm">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-2.5 py-1.5 font-medium text-muted hover:bg-background hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {children}

      <AccountMenu
        email={session.email}
        signOutAction={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      />
    </div>
  );
}
