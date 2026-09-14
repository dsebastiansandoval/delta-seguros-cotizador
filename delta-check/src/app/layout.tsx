import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Delta Check",
  description: "Cotizador comparativo para agentes de seguros",
};

// Aplica el tema guardado (si lo hay) antes del primer paint — sin esto se
// ve un parpadeo del tema equivocado en cada carga de página, porque el
// HTML del servidor siempre sale sin `data-theme` (el servidor no sabe qué
// hay en el localStorage del navegador). Ver ThemeToggle.tsx.
//
// Tiene que ser <Script strategy="beforeInteractive">, no un <script> a
// mano dentro de un <head> propio — probado en vivo y un <script> plano
// ahí nunca se ejecuta bajo App Router/Turbopack (el HTML servido lo
// trae, pero el navegador no lo corre). beforeInteractive es la única
// forma soportada de garantizar código antes de la hidratación.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("delta-check-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
