"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Resumen",
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
};

// uuid v4-ish o cualquier id largo alfanumérico — no se resuelve a un
// nombre real (requeriría una consulta por página, ver plan de reorg §
// "Fuera de alcance"), se muestra como "Detalle" en vez de un uuid crudo.
const DYNAMIC_SEGMENT = /^[0-9a-f-]{20,}$/i;

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
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = DYNAMIC_SEGMENT.test(segment) ? "Detalle" : (SEGMENT_LABELS[segment] ?? segment);
    return { href, label };
  });

  return (
    <nav aria-label="Ruta actual" className="hidden items-center gap-1.5 text-sm text-muted lg:flex">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true">›</span>}
          {i === crumbs.length - 1 ? (
            <span className="font-semibold text-foreground">{crumb.label}</span>
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
