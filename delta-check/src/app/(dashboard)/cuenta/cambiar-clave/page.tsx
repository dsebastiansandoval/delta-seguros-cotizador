import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";

export default function CambiarClavePage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Cambiar clave</h1>
        <p className="mt-1 text-sm text-muted">Pedimos tu clave actual para confirmar que sos vos.</p>
      </header>
      <ChangePasswordForm />
    </main>
  );
}
