"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavLink = { href: string; label: string; activePrefix?: string; disabled?: boolean; exact?: boolean };

function isActive(pathname: string, link: NavLink): boolean {
  const prefix = link.activePrefix ?? link.href;
  return prefix === "/dashboard" || link.exact ? pathname === prefix : pathname.startsWith(prefix);
}

/**
 * Nav horizontal del topbar — mockup: `.topnav a.active`. Un link con
 * `disabled` (ej. "Back-office", pensado para acceso de administrador
 * más adelante) se muestra sin `href` real ni hover — nunca algo que
 * parezca clickeable y no haga nada.
 */
export function TopNavLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1">
      {links.map((link) =>
        link.disabled ? (
          <span
            key={link.href}
            title="Próximamente"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted opacity-60"
          >
            {link.label}
            <span className="rounded bg-background px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide">
              Pronto
            </span>
          </span>
        ) : (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-2 text-sm font-semibold no-underline ${
              isActive(pathname, link) ? "bg-accent-100 text-link" : "text-muted hover:bg-background hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        ),
      )}
    </nav>
  );
}

export type NavGroup = { label: string; links: NavLink[] };

/** Sidebar agrupado — mockup: `.side-section`/`.side-link.active` (navy sólido, no el tinte claro del topbar). */
export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  return (
    <>
      {groups.map((group) => (
        <div key={group.label} className="mb-5">
          <div className="mb-2 px-3 text-[10.5px] font-bold uppercase tracking-wider text-muted">{group.label}</div>
          <div className="flex flex-col gap-0.5">
            {group.links.map((link) => {
              if (link.disabled) {
                return (
                  <span
                    key={link.href}
                    title="Próximamente"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted opacity-60"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong" />
                    {link.label}
                    <span className="ml-auto rounded bg-background px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide">
                      Pronto
                    </span>
                  </span>
                );
              }
              const active = isActive(pathname, link);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold no-underline ${
                    active ? "bg-delta-navy text-white" : "text-foreground hover:bg-background"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-accent-500" : "bg-border-strong"}`} />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
