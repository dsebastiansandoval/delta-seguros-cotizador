import { Resend } from "resend";
import { env } from "./env";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/**
 * Sin `RESEND_API_KEY` (típico en local, antes de tener la cuenta de Resend
 * configurada) no se rompe nada — el link queda en el log del servidor en
 * vez de mandarse. Mismo criterio no-op que `rate-limit.ts` sin Upstash.
 */
export async function sendPasswordSetupEmail({
  to,
  fullName,
  link,
  isNewAccount,
}: {
  to: string;
  fullName: string;
  link: string;
  isNewAccount: boolean;
}): Promise<{ sent: boolean }> {
  const subject = isNewAccount ? "Creá tu clave — Cotizador Delta Seguros" : "Recuperar clave — Cotizador Delta Seguros";
  const intro = isNewAccount
    ? `Te dieron de alta en Cotizador Delta Seguros. Entrá al siguiente link para crear tu clave:`
    : `Pediste recuperar tu clave de Cotizador Delta Seguros. Entrá al siguiente link para crear una nueva:`;

  if (!resend) {
    console.warn(`[email] RESEND_API_KEY no configurado — no se envió correo a ${to}. Link: ${link}`);
    return { sent: false };
  }

  // `resend.emails.send()` nunca tira excepción por un error de la API —
  // lo devuelve adentro de la respuesta (`{ data: null, error: {...} }`),
  // así que había que chequearlo a mano. Antes este `if` no existía: el
  // correo podía fallar en silencio y el código igual devolvía `sent: true`.
  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html: `
      <p>Hola ${fullName},</p>
      <p>${intro}</p>
      <p><a href="${link}">${link}</a></p>
      <p>El link vence en 24 horas. Si no pediste esto, podés ignorar el correo.</p>
    `,
  });
  if (error) {
    console.error(`[email] Resend rechazó el correo a ${to}: ${error.name} — ${error.message}`);
    return { sent: false };
  }
  return { sent: Boolean(data) };
}
