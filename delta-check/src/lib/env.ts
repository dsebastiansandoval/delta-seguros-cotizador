import { z } from "zod";
import { config } from "dotenv";

// Next.js ya carga .env.local por su cuenta antes de ejecutar cualquier
// código; los scripts standalone (seed, drizzle-kit) no pasan por ahí.
// `override: false` hace que esto sea un no-op inofensivo bajo Next —
// nunca pisa lo que Next ya puso en process.env.
config({ path: ".env.local", override: false });

/**
 * Valida las variables de entorno una sola vez, al arrancar. Si falta algo
 * requerido, el build/arranque falla aquí — no a mitad de una request.
 * Ver ARCHITECTURE.md §1.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1, "Generar con: npx auth secret"),

  // Opcionales en desarrollo: sin credenciales, el provider correspondiente
  // simplemente no se registra en auth.ts (ver ARCHITECTURE.md §11.3).
  AUTH_MICROSOFT_ENTRA_ID_ID: z.string().optional(),
  AUTH_MICROSOFT_ENTRA_ID_SECRET: z.string().optional(),
  AUTH_MICROSOFT_ENTRA_ID_ISSUER: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),

  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Lookup de placa (EcuadorAPI, $0.02/consulta) — opcional: sin esto, el
  // autocompletado de vehículo por placa queda deshabilitado (ERROR), no
  // rompe el arranque. Cédula/RUC no la necesitan, van directo al SRI gratis.
  ECUADOR_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variables de entorno inválidas:", parsed.error.flatten().fieldErrors);
  throw new Error("Variables de entorno inválidas — revisa .env.local contra .env.example");
}

export const env = parsed.data;
