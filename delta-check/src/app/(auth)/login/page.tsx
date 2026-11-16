import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError, CredentialsSignin } from "next-auth";
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
  // `credentials` es el `code` genérico de CredentialsSignin (límite de
  // intentos, o campos vacíos) — los otros dos son los `code` de
  // InvalidEmailSignin/InvalidPasswordSignin (auth.ts), que si distinguen
  // cuál de los dos está mal, a pedido explícito del usuario.
  credentials: "Correo o contraseña incorrectos.",
  "correo-no-existe": "Ese correo no tiene una cuenta en Cotizador Delta Seguros.",
  "clave-incorrecta": "La contraseña es incorrecta.",
  // No debería mostrarse nunca en la práctica — el formulario redirige
  // directo a /recuperar-clave antes de llegar a pintar este mensaje (ver
  // el `redirect` en el action de abajo). Queda como respaldo por si acaso.
  "sin-clave": "Esa cuenta todavía no tiene clave creada — te mandamos un link para crearla.",
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
            <a href="https://www.deltaseguros.com.ec">
              {/* eslint-disable-next-line @next/next/no-img-element -- logo chico y fijo, mismo patrón que (dashboard)/layout.tsx */}
              <img src="/delta-logo.png" alt="Delta Seguros" className="h-11 w-auto rounded-lg bg-white p-2 shadow-sm" />
            </a>
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
          ) : null}

          <form
            action={async (formData) => {
              "use server";
              const email = formData.get("email");
              try {
                await signIn("credentials", {
                  email,
                  password: formData.get("password"),
                  redirectTo: "/",
                });
              } catch (error) {
                // `authorize` lanza InvalidEmailSignin/InvalidPasswordSignin/
                // NoPasswordSignin (auth.ts) en vez de devolver null ->
                // next-auth lanza AuthError en vez de redirigir solo — sin
                // este catch, esa excepción llegaba sin manejar y Next.js
                // mostraba la pantalla genérica de error de servidor en vez
                // del mensaje de /login?error=... Se usa `code` (no `type`)
                // para distinguir correo-no-existe de clave-incorrecta.
                if (error instanceof AuthError) {
                  const reason = error instanceof CredentialsSignin ? error.code : error.type;
                  // Cuenta real sin clave todavía — en vez de mostrar un
                  // mensaje y esperar que el usuario encuentre "Olvidé mi
                  // contraseña", lo manda directo ahí con el correo ya
                  // puesto (pedido explícito: entrar con el correo y que lo
                  // mande solo a crear su clave inicial).
                  if (reason === "sin-clave" && typeof email === "string") {
                    redirect(`/recuperar-clave?email=${encodeURIComponent(email)}&motivo=sin-clave`);
                  }
                  redirect(`/login?error=${reason}`);
                }
                throw error;
              }
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
            {/* No required: dejar la clave en blanco y mandar el correo
                es justo cómo una cuenta recién creada detecta que no tiene
                clave todavía y se la redirige a crearla (ver el `action`
                de abajo y `NoPasswordSignin` en auth.ts). */}
            <PasswordField
              id="login-password"
              name="password"
              label="Contraseña"
              required={false}
              autoComplete="current-password"
            />
            <button
              type="submit"
              className="rounded-lg bg-delta-navy px-3 py-2.5 text-sm font-semibold text-white"
            >
              Entrar
            </button>
            <Link href="/recuperar-clave" className="text-center text-xs text-link underline">
              Olvidé mi contraseña
            </Link>
          </form>

          {process.env.NODE_ENV === "development" && (
            <form
              action={async (formData) => {
                "use server";
                try {
                  await signIn("dev-login", { email: formData.get("email"), redirectTo: "/" });
                } catch (error) {
                  if (error instanceof AuthError) {
                    const reason = error instanceof CredentialsSignin ? error.code : error.type;
                    redirect(`/login?error=${reason}`);
                  }
                  throw error;
                }
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
