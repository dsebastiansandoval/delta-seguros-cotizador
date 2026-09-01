export default function LoginPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-8">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-delta-navy font-mono text-sm font-bold text-white">
          DC
        </div>
        <h1 className="text-lg font-bold tracking-tight">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-muted">
          Login con Microsoft, Google y correo — pendiente de conectar
          (ARCHITECTURE.md §11.3).
        </p>
      </div>
    </main>
  );
}
