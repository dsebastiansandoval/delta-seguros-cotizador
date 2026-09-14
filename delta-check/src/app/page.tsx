import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth";

/**
 * "/" ya no es una página propia — antes mostraba un texto fijo ("el login
 * y el flujo de cotización todavía no están conectados") que quedó
 * obsoleto desde Fase 1. Ahora es solo el punto de entrada: manda a
 * /dashboard si ya hay sesión, o a /login si no.
 */
export default async function HomePage() {
  const session = await getAppSession();
  redirect(session ? "/dashboard" : "/login");
}
