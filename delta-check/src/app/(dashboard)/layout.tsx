import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSession, signOut } from "@/lib/auth";
import { AccountMenu } from "@/components/shared/AccountMenu";
import { TopNavLinks, SidebarNav, type NavLink, type NavGroup } from "@/components/shared/DashboardNav";

const TOPBAR_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Resumen" },
  { href: "/cotizar/autos", label: "Autos", activePrefix: "/cotizar/autos" },
  { href: "/cotizar/salud/nueva", label: "Salud", activePrefix: "/cotizar/salud" },
  // Acceso de administrador (roles/usuarios, plantillas de tasas
  // multi-tenant) — a pedido del usuario, visible ya pero sin abrir nada
  // todavía: no existe esa pantalla, y RBAC.md (ARCHITECTURE.md §8.4) no
  // tiene una noción de "back-office" propia que construir sin diseñarla.
  { href: "#", label: "Back-office", disabled: true },
];

const SIDEBAR_GROUPS: NavGroup[] = [
  {
    label: "Cotizador",
    links: [
      { href: "/cotizar/autos/nueva", label: "Nueva cotización — Autos" },
      { href: "/cotizar/autos", label: "Mis cotizaciones — Autos", exact: true },
      { href: "/cotizar/salud/nueva", label: "Nueva cotización — Salud", activePrefix: "/cotizar/salud" },
      // Del mockup visual original — sin ninguna macro ni hoja propia en el
      // Excel (PRODUCTOS solo tiene VEHICULOS/ASISTENCIA_MEDICA, EXCEL-
      // AUDIT.md), así que va como "Pronto" (mismo patrón que Back-office)
      // en vez de fabricar una pantalla sin ramo real que cotizar todavía.
      { href: "#", label: "Vida & Patrimonio", disabled: true },
    ],
  },
  {
    label: "Gestión",
    links: [
      { href: "/cartera", label: "Cartera" },
      { href: "/comisiones", label: "Comisiones" },
      { href: "/siniestros", label: "Siniestros" },
    ],
  },
  {
    label: "Cumplimiento",
    links: [{ href: "/cumplimiento", label: "Derechos ARCO" }],
  },
];

/**
 * Shell de navegación para todas las páginas autenticadas — adaptado de
 * Cotizador-Delta-MVP-visual.html (el diseño original aprobado, a pedido
 * del usuario), con topbar + sidebar en vez del solo-topbar de antes.
 * Los links son los reales del sistema, no el listado completo del mockup
 * — se dejaron afuera "Vida & Patrimonio", "Emisiones"/"Renovaciones" como
 * páginas propias, "Ejecutivos" y "Configuración": no existe esa pantalla
 * todavía, y un link muerto es peor que un sidebar más corto pero real.
 *
 * También hace explícito el guard de sesión (redirect a /login) que antes
 * solo existía implícito en cada Server Action — `proxy.ts` (el middleware
 * renombrado en Next 16) ya cubre esto a nivel global, así que este guard
 * es defensa en profundidad, no el único lugar donde se resuelve.
 */
export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const session = await getAppSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-surface">
        <div className="flex items-center justify-between gap-5 px-7 py-3.5">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- logo chico y fijo, no vale la pena next/image acá */}
              <img src="/delta-logo.png" alt="Delta Seguros" className="h-7 w-auto rounded bg-white p-1" />
            </Link>
            <TopNavLinks links={TOPBAR_LINKS} />
          </div>

          <AccountMenu
            email={session.email}
            fullName={session.fullName}
            signOutAction={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1320px] flex-1">
        <aside className="hidden w-56 shrink-0 flex-col p-5 md:flex">
          <SidebarNav groups={SIDEBAR_GROUPS} />
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
