import { SetPasswordForm } from "@/components/auth/SetPasswordForm";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

export default async function CrearClavePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <ThemeToggle />
      <main className="flex min-h-full flex-1 items-center justify-center p-8">
        <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-sm">
          <h1 className="text-lg font-bold tracking-tight">Creá tu clave</h1>
          <p className="mt-1 text-sm text-muted">Mínimo 8 caracteres.</p>
          <div className="mt-4">
            <SetPasswordForm token={token} />
          </div>
        </div>
      </main>
    </>
  );
}
