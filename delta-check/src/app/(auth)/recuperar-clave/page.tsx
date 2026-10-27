import Link from "next/link";
import { RequestPasswordResetForm } from "@/components/auth/RequestPasswordResetForm";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

export default function RecuperarClavePage() {
  return (
    <>
      <ThemeToggle />
      <main className="flex min-h-full flex-1 items-center justify-center p-8">
        <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-sm">
          <h1 className="text-lg font-bold tracking-tight">Recuperar clave</h1>
          <p className="mt-1 text-sm text-muted">Te mandamos un link para crear una clave nueva.</p>
          <div className="mt-4">
            <RequestPasswordResetForm />
          </div>
          <Link href="/login" className="mt-4 inline-block text-xs text-link underline">
            Volver a iniciar sesión
          </Link>
        </div>
      </main>
    </>
  );
}
