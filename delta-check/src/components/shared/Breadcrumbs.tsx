"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  cotizar: "Cotizador",
  autos: "Autos",
  salud: "Salud AM",
  nueva: "Nueva",
  comparar: "Comparativa",
  opciones: "Opciones",
  coberturas: "Coberturas",
  cartera: "Cartera",
  emitir: "Emitir póliza",
  comisiones: "Comisiones",
  siniestros: "Siniestros",
  nuevo: "Nuevo",
  cumplimiento: "Derechos ARCO",
  buscar: "Buscar",
  "back-office": "Back-office",
  admin: "Administración",
  usuarios: "Usuarios",
  "tarifas-salud": "Tarifas Salud",
  configuracion: "Configuración",
};

// uuid v4-ish o cualquier id largo alfanumérico — no se resuelve a un
// nombre real (requeriría una consulta por página, ver plan de reorg §
// "Fuera de alcance"), se muestra como "Detalle" en vez de un uuid crudo.
const DYNAMIC_SEGMENT = /^[0-9a-f-]{20,}$/i;

const PARAM = Symbol("param");

// Rutas que realmente existen bajo app/(dashboard) — un segmento intermedio
// (p. ej. /cotizar/autos/{quoteId} sin /comparar) no tiene page.tsx propio,
// así que solo estos prefijos exactos se renderizan como link; el resto se
// muestra como texto plano para no mandar a un 404.
const KNOWN_ROUTES: (string | typeof PARAM)[][] = [
  ["dashboard"],
  ["buscar"],
  ["cartera"],
  ["cartera", PARAM],
  ["cartera", "emitir"],
  ["comisiones"],
  ["cotizar", "autos"],
  ["cotizar", "autos", "nueva"],
  ["cotizar", "autos", PARAM, "comparar"],
  ["cotizar", "autos", PARAM, "opciones", PARAM, "coberturas"],
  ["cotizar", "salud"],
  ["cotizar", "salud", "nueva"],
  ["cotizar", "salud", PARAM, "comparar"],
  ["cotizar", "salud", PARAM, "opciones", PARAM, "coberturas"],
  ["cumplimiento"],
  ["cumplimiento", "nueva"],
  ["cumplimiento", PARAM],
  ["siniestros"],
  ["siniestros", "nuevo"],
  ["back-office"],
  ["admin", "usuarios"],
  ["admin", "tarifas-salud"],
  ["admin", "configuracion"],
];

function isKnownRoute(segments: string[]): boolean {
  return KNOWN_ROUTES.some(
    (pattern) =>
      pattern.length === segments.length &&
      pattern.every((part, i) => (part === PARAM ? DYNAMIC_SEGMENT.test(segments[i]) : part === segments[i])),
  );
}

/**
 * Migas de pan del topbar (propuesta de reorganización del usuario) —
 * basadas en los segmentos de la URL con un diccionario estático de
 * labels, no en nombres de entidad reales (cliente/cotización): eso
 * requeriría resolver el nombre en cada página y pasarlo al layout, fuera
 * de alcance de esta pasada.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, i) => {
    const prefix = segments.slice(0, i + 1);
    const href = "/" + prefix.join("/");
    const label = DYNAMIC_SEGMENT.test(segment) ? "Detalle" : (SEGMENT_LABELS[segment] ?? segment);
    return { href, label, isLink: isKnownRoute(prefix) };
  });

  return (
    <nav aria-label="Ruta actual" className="hidden items-center gap-1.5 text-sm text-muted lg:flex">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true">›</span>}
          {i === crumbs.length - 1 || !crumb.isLink ? (
            <span className={i === crumbs.length - 1 ? "font-semibold text-foreground" : undefined}>
              {crumb.label}
            </span>
          ) : (
            <Link href={crumb.href} className="no-underline hover:text-foreground">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
