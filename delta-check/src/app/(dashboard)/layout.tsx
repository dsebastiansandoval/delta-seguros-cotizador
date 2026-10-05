import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSession, signOut } from "@/lib/auth";
import { AccountMenu } from "@/components/shared/AccountMenu";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { NuevaCotizacionMenu } from "@/components/shared/NuevaCotizacionMenu";
import { SidebarNav, type NavGroup } from "@/components/shared/DashboardNav";

/**
 * Reorganización de navegación (propuesta del usuario): el sidebar pasa a
 * ser el eje principal, el topbar queda solo para utilidades de contexto
 * (breadcrumbs, buscador, perfil) — antes también tenía los mismos links
 * de ramo duplicados del sidebar.
 */
const SIDEBAR_GROUPS: NavGroup[] = [
  {
    label: "General",
    links: [{ href: "/dashboard", label: "Dashboard" }],
  },
  {
    label: "Cotizador",
    links: [
      // "Autos" y "Salud AM" apuntan a su lista ("Mis cotizaciones"), no al
      // formulario de nueva cotización — cada lista trae su propio botón
      // "+ Nueva" adentro. A pedido explícito del usuario (antes "Autos"
      // iba directo al formulario y "Mis cotizaciones" era una entrada
      // aparte).
      { href: "/cotizar/autos", label: "Autos", exact: true },
      { href: "/cotizar/salud", label: "Salud AM", activePrefix: "/cotizar/salud" },
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
  {
    label: "Administración",
    links: [
      // Ninguna tiene pantalla propia todavía — "Pronto", mismo criterio
      // que "Vida & Patrimonio": un link muerto es peor que uno deshabilitado.
      { href: "#", label: "Ejecutivos", disabled: true },
      { href: "#", label: "Configuración", disabled: true },
      { href: "#", label: "Back-office", disabled: true },
    ],
  },
];

/**
 * Shell de navegación para todas las páginas autenticadas — adaptado de
 * Cotizador-Delta-MVP-visual.html (el diseño original aprobado, a pedido
 * del usuario), con topbar + sidebar en vez del solo-topbar de antes.
 * Reorganizado después a pedido del usuario: el sidebar es el eje
 * principal de navegación (grupo "General" con Resumen, CTA "+ Nueva
 * cotización" arriba), y el topbar queda solo para utilidades de contexto
 * (breadcrumbs, buscador, perfil) — ya no duplica los links de ramo.
 * "Vida & Patrimonio", "Ejecutivos", "Configuración" y "Back-office"
 * aparecen como "Pronto" (deshabilitados) — ninguno tiene pantalla propia
 * todavía; un link muerto es peor que uno deshabilitado, pero un sidebar
 * que no refleja el mapa real del producto es peor todavía.
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
            <Breadcrumbs />
          </div>

          <div className="flex items-center gap-4">
            {/* Buscador del topbar (mockup visual, ítem 5 del feedback) —
                GET nativo a /buscar, sin JS ni Server Action: alcanza para
                un campo de búsqueda simple. */}
            <form action="/buscar" method="GET" className="hidden w-56 md:block">
              <input
                type="search"
                name="q"
                placeholder="🔍 Buscar cliente o placa…"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </form>

            <AccountMenu
              email={session.email}
              fullName={session.fullName}
              signOutAction={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1320px] flex-1">
        <aside className="hidden w-56 shrink-0 flex-col p-5 md:flex">
          <NuevaCotizacionMenu />
          <SidebarNav groups={SIDEBAR_GROUPS} />
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
