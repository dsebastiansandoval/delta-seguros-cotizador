import type { Metadata } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cotizador Delta Seguros",
  description: "Cotizador comparativo para agentes de seguros",
};

// Aplica el tema guardado (si lo hay) antes del primer paint — sin esto se
// ve un parpadeo del tema equivocado en cada carga de página, porque el
// HTML del servidor siempre sale sin `data-theme` (el servidor no sabe qué
// hay en el localStorage del navegador). Ver ThemeToggle.tsx.
//
// <Script strategy="beforeInteractive"> con el nonce de proxy.ts — la CSP
// exige un nonce por request para cualquier script, inline o no (ver el
// comentario largo en proxy.ts: esto fue, retroactivamente, la causa real
// del "problema de hidratación" documentado en este proyecto — no era la
// herramienta de automatización, era nuestra propia CSP bloqueando en
// silencio los scripts de arranque de Next.js).
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("cotizador-delta-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive" nonce={nonce}>
          {THEME_INIT_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
