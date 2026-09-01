import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-8">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-delta-navy font-mono text-sm font-bold text-white">
          DC
        </div>
        <h1 className="text-lg font-bold tracking-tight">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-muted">
          Login con Microsoft y Google — pendiente de credenciales reales
          (ARCHITECTURE.md §11.3).
        </p>

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
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
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
    </main>
  );
}
