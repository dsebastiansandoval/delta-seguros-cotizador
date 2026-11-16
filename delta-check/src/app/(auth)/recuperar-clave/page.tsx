import Link from "next/link";
import { RequestPasswordResetForm } from "@/components/auth/RequestPasswordResetForm";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

export default async function RecuperarClavePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; motivo?: string }>;
}) {
  const { email, motivo } = await searchParams;
  // Llega acá desde /login cuando la cuenta existe pero todavía no tiene
  // clave (NoPasswordSignin, auth.ts) — mismo formulario/acción de
  // siempre, solo cambia el título y trae el correo ya puesto.
  const isNewAccount = motivo === "sin-clave";

  return (
    <>
      <ThemeToggle />
      <main className="flex min-h-full flex-1 items-center justify-center p-8">
        <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-sm">
          <h1 className="text-lg font-bold tracking-tight">
            {isNewAccount ? "Creá tu clave" : "Recuperar contraseña"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {isNewAccount
              ? "Tu cuenta todavía no tiene una clave — te mandamos un link para crear la primera."
              : "Te mandamos un link para crear una contraseña nueva."}
          </p>
          <div className="mt-4">
            <RequestPasswordResetForm defaultEmail={email} />
          </div>
          <Link href="/login" className="mt-4 inline-block text-xs text-link underline">
            Volver a iniciar sesión
          </Link>
        </div>
      </main>
    </>
  );
}
