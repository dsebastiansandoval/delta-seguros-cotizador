export default function HomePage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-8">
      <div className="max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-delta-navy font-mono text-sm font-bold text-white">
          DC
        </div>
        <h1 className="text-xl font-bold tracking-tight">Delta Check</h1>
        <p className="mt-2 text-sm text-muted">
          Base del proyecto en construcción — Fase 1. El login y el flujo de
          cotización todavía no están conectados.
        </p>
      </div>
    </main>
  );
}
