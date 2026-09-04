import { ArcoRequestForm } from "@/components/compliance/ArcoRequestForm";

export default function NuevaSolicitudArcoPage() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Nueva solicitud ARCO</h1>
        <p className="mt-1 text-sm text-muted">
          Registrá el pedido tal como lo hizo el titular — el cliente debe existir ya en el
          sistema (haber cotizado antes).
        </p>
      </header>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <ArcoRequestForm />
      </div>
    </main>
  );
}
