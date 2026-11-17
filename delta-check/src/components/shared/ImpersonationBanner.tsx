"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { stopImpersonation } from "@/actions/user.actions";

/**
 * Aviso fijo mientras un ADMIN está "viendo como" otro usuario
 * (rbac.service.ts, loadGrants) — para que nunca sea ambiguo en qué
 * sesión se está, ni se quede alguien suplantando por error. "Salir"
 * navega a /dashboard después de borrar la cookie — todo el layout
 * (sidebar, permisos) se arma en el servidor, así que la navegación ya lo
 * re-resuelve con la sesión real.
 */
export function ImpersonationBanner({
  adminName,
  viewingAsName,
}: {
  adminName: string;
  viewingAsName: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleExit() {
    startTransition(async () => {
      await stopImpersonation();
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-600 px-5 py-2 text-sm font-semibold text-white">
      <span>
        {adminName} está viendo Cotizador Delta Seguros como <strong>{viewingAsName ?? "otro usuario"}</strong>.
      </span>
      <button
        type="button"
        onClick={handleExit}
        disabled={pending}
        className="rounded-md bg-white/20 px-3 py-1 text-xs font-bold hover:bg-white/30 disabled:opacity-60"
      >
        {pending ? "…" : "Salir"}
      </button>
    </div>
  );
}
