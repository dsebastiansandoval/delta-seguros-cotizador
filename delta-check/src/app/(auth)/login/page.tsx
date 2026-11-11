import Link from "next/link";
import { MICROSOFT_ALLOWED_DOMAIN, signIn } from "@/lib/auth";
import { env } from "@/lib/env";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { PasswordField } from "@/components/shared/PasswordField";

/**
 * Mensajes de los rechazos del callback `signIn` en auth.ts — dos motivos
 * distintos en vez del "AccessDenied" genérico de Auth.js (ver §19 de
 * ARCHITECTURE.md).
 */
const ERROR_MESSAGES: Record<string, string> = {
  dominio: `Esa cuenta no es de Delta Seguros — solo entra una cuenta ${MICROSOFT_ALLOWED_DOMAIN}.`,
  "sin-acceso":
    "Esa cuenta es de Delta Seguros pero todavía no tiene acceso asignado en Cotizador Delta Seguros — pídele a un administrador que te agregue.",
  CredentialsSignin: "Correo o clave incorrectos.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "No se pudo iniciar sesión.") : null;

  // Mismo criterio que auth.ts: el botón real solo aparece si las
  // credenciales de Microsoft ya están configuradas — nunca se muestra un
  // botón que fallaría al primer clic.
  const microsoftConfigured = Boolean(env.AUTH_MICROSOFT_ENTRA_ID_ID && env.AUTH_MICROSOFT_ENTRA_ID_SECRET);

  return (
    <>
      <ThemeToggle />
      <main className="login-backdrop relative flex min-h-full flex-1 items-center justify-center p-8">
        <div aria-hidden className="login-orb login-orb-1" />
        <div aria-hidden className="login-orb login-orb-2" />
        <div aria-hidden className="login-orb login-orb-3" />

        <div className="login-card relative w-full max-w-sm">
          <div className="mb-6 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo chico y fijo, mismo patrón que (dashboard)/layout.tsx */}
            <img src="/delta-logo.png" alt="Delta Seguros" className="h-11 w-auto rounded-lg bg-white p-2 shadow-sm" />
          </div>

          <div className="rounded-2xl border border-border bg-surface p-8 shadow-xl">
          <h1 className="text-lg font-bold tracking-tight">Iniciar sesión</h1>
          <p className="mt-1 text-xs text-muted">Portal de cotizaciones de Delta Seguros</p>

          {errorMessage && (
            <p className="mt-3 rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-xs text-red-400">
              {errorMessage}
            </p>
          )}

          {microsoftConfigured ? (
            <form
              action={async () => {
                "use server";
                await signIn("microsoft-entra-id", { redirectTo: "/" });
              }}
              className="mt-4"
            >
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-semibold hover:bg-surface"
              >
                Iniciar sesión con Microsoft
              </button>
              <p className="mt-2 text-center text-xs text-muted">Solo cuentas {MICROSOFT_ALLOWED_DOMAIN}</p>
            </form>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Login con Microsoft — pendiente de credenciales reales de Delta (ARCHITECTURE.md §11.3). Cuando estén,
              solo cuentas {MICROSOFT_ALLOWED_DOMAIN} van a poder entrar.
            </p>
          )}

          <form
            action={async (formData) => {
              "use server";
              await signIn("credentials", {
                email: formData.get("email"),
                password: formData.get("password"),
                redirectTo: "/",
              });
            }}
            className="mt-6 flex flex-col gap-3 border-t border-border pt-6"
          >
            <div>
              <label className="text-xs font-semibold text-muted" htmlFor="login-email">
                Correo
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              />
            </div>
            <PasswordField id="login-password" name="password" label="Clave" autoComplete="current-password" />
            <button
              type="submit"
              className="rounded-lg bg-delta-navy px-3 py-2.5 text-sm font-semibold text-white"
            >
              Entrar
            </button>
            <Link href="/recuperar-clave" className="text-center text-xs text-link underline">
              Olvidé mi clave
            </Link>
          </form>

          {process.env.NODE_ENV === "development" && (
            <form
              action={async (formData) => {
                "use server";
                await signIn("dev-login", { email: formData.get("email"), redirectTo: "/" });
              }}
              className="mt-6 flex flex-col gap-3 border-t border-border pt-6"
            >
              <label className="text-xs font-semibold text-muted" htmlFor="email">
                Solo desarrollo — email del usuario sembrado
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue="dev@deltaseguros.local"
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded-lg bg-delta-navy px-3 py-2 text-sm font-semibold text-white"
              >
                Entrar (dev)
              </button>
            </form>
          )}
          </div>
        </div>
      </main>
    </>
  );
}
