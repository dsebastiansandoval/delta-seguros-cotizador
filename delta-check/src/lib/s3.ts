import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";

/**
 * Adjuntos de Siniestros (Workstream F.1/E.5, reunión 6-nov) — el archivo
 * sube/baja directo entre el navegador y S3 por URL firmada (nunca pasa por
 * el servidor de Next, evita el límite de tamaño de una Server Action).
 * Sin las 4 variables de entorno, `attachmentsEnabled` es `false` y la
 * sección de adjuntos se oculta en vez de romper — mismo criterio no-op que
 * Resend/EcuadorAPI en este proyecto.
 */
const configured = Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_REGION && env.AWS_S3_BUCKET_ATTACHMENTS);

const client = configured
  ? new S3Client({
      region: env.AWS_REGION!,
      credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID!, secretAccessKey: env.AWS_SECRET_ACCESS_KEY! },
    })
  : null;

export const attachmentsEnabled = configured;

const SIGNED_URL_TTL_SECONDS = 300;

export async function createAttachmentUploadUrl(key: string, contentType: string): Promise<string | null> {
  if (!client) return null;
  const command = new PutObjectCommand({ Bucket: env.AWS_S3_BUCKET_ATTACHMENTS!, Key: key, ContentType: contentType });
  return getSignedUrl(client, command, { expiresIn: SIGNED_URL_TTL_SECONDS });
}

export async function createAttachmentDownloadUrl(key: string): Promise<string | null> {
  if (!client) return null;
  const command = new GetObjectCommand({ Bucket: env.AWS_S3_BUCKET_ATTACHMENTS!, Key: key });
  return getSignedUrl(client, command, { expiresIn: SIGNED_URL_TTL_SECONDS });
}

export async function deleteAttachmentObject(key: string): Promise<void> {
  if (!client) return;
  await client.send(new DeleteObjectCommand({ Bucket: env.AWS_S3_BUCKET_ATTACHMENTS!, Key: key }));
}
