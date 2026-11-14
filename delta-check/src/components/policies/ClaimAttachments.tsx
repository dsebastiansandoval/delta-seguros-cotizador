"use client";

import { useRef, useState, useTransition } from "react";
import {
  confirmClaimAttachment,
  createClaimAttachmentUploadUrl,
  getClaimAttachmentDownloadUrl,
} from "@/actions/claim.actions";

type Attachment = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: Date;
  uploadedByName: string | null;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Sube directo del navegador a S3 con una URL firmada (dos pasos: pedir la
 * URL, hacer el PUT, confirmar la metadata) — nunca pasa el archivo por una
 * Server Action. `router.refresh()` tras confirmar, en vez de mantener la
 * lista en estado local, porque el resto del detalle de siniestro ya es
 * server-rendered (mismo patrón que el resto de esta página).
 */
export function ClaimAttachments({ claimId, initialAttachments }: { claimId: string; initialAttachments: Attachment[] }) {
  const [attachments, setAttachments] = useState(initialAttachments);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, startUpload] = useTransition();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleUpload(file: File) {
    setError(null);
    startUpload(async () => {
      // Server Actions que lanzan (permiso faltante, S3 mal configurado,
      // red) tienen que caer acá — sin este try/catch, la excepción queda
      // sin manejar y Next.js muestra la pantalla genérica de error en vez
      // del mensaje (mismo bug ya encontrado y arreglado en /login).
      let prepared: Awaited<ReturnType<typeof createClaimAttachmentUploadUrl>>;
      try {
        prepared = await createClaimAttachmentUploadUrl(claimId, file.name, file.type || "application/octet-stream", file.size);
      } catch {
        setError("Paso 1 (pedir URL a S3) falló — revisa las credenciales/región de AWS en el servidor");
        return;
      }
      if (!prepared.ok) {
        setError(prepared.message);
        return;
      }

      // El PUT va del navegador directo a S3 (nunca pasa por nuestro
      // servidor) — si el bucket no tiene habilitado CORS para este
      // origen, el navegador bloquea la petición antes de que llegue a S3
      // y `fetch` lanza en vez de devolver una respuesta con status malo.
      let putRes: Response;
      try {
        putRes = await fetch(prepared.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
      } catch {
        setError("Paso 2 (subir a S3) falló — probablemente falta configurar CORS en el bucket de S3 para este dominio");
        return;
      }
      if (!putRes.ok) {
        setError(`Paso 2 (subir a S3) devolvió ${putRes.status} — revisa los permisos del bucket`);
        return;
      }

      let confirmed: Awaited<ReturnType<typeof confirmClaimAttachment>>;
      try {
        confirmed = await confirmClaimAttachment({
          claimId,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          s3Key: prepared.s3Key,
        });
      } catch {
        setError("El archivo subió a S3 pero el paso 3 (guardar metadata) falló — intenta de nuevo");
        return;
      }
      if (!confirmed.ok) {
        setError("El archivo subió pero no se pudo guardar — intenta de nuevo");
        return;
      }

      setAttachments((prev) => [
        { id: confirmed.value.attachmentId, fileName: file.name, contentType: file.type, sizeBytes: file.size, createdAt: new Date(), uploadedByName: null },
        ...prev,
      ]);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  async function handleDownload(attachmentId: string) {
    setDownloadingId(attachmentId);
    try {
      const url = await getClaimAttachmentDownloadUrl(attachmentId);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else setError("No se pudo generar el link de descarga");
    } catch {
      setError("No se pudo descargar el archivo — intenta de nuevo");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        Adjuntos — {attachments.length} {attachments.length === 1 ? "archivo" : "archivos"}
      </h2>

      <ul className="mb-3 flex flex-col gap-2">
        {attachments.length === 0 && <li className="text-sm text-muted">Sin adjuntos todavía.</li>}
        {attachments.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            <span className="truncate">
              {a.fileName} <span className="text-xs text-muted">· {formatSize(a.sizeBytes)}</span>
            </span>
            <button
              type="button"
              onClick={() => handleDownload(a.id)}
              disabled={downloadingId === a.id}
              className="shrink-0 text-xs font-semibold text-link underline disabled:opacity-60"
            >
              {downloadingId === a.id ? "…" : "Descargar"}
            </button>
          </li>
        ))}
      </ul>

      <input
        ref={inputRef}
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
        disabled={isUploading}
        className="text-sm"
      />
      {isUploading && <p className="mt-1 text-xs text-muted">Subiendo…</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </section>
  );
}
