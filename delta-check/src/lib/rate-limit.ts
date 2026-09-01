import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "./env";

/**
 * ARCHITECTURE.md §8.2 — login 5/min/IP, cotizar 30/min/usuario. Sin
 * credenciales de Upstash configuradas (típico en local) esto se vuelve
 * no-op en vez de romper el arranque: mejor dejar pasar sin límite en dev
 * que fingir un límite que no existe.
 */
const redis =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
    : null;

type Window = `${number} s` | `${number} m` | `${number} h`;

const limiters = new Map<string, Ratelimit>();

function getLimiter(key: string, limit: number, window: Window): Ratelimit {
  const cacheKey = `${key}:${limit}:${window}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `delta-check:${key}`,
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

export class RateLimitExceededError extends Error {
  constructor(key: string) {
    super(`Límite de solicitudes excedido: ${key}`);
    this.name = "RateLimitExceededError";
  }
}

/**
 * Uso: `await rateLimit(\`quote:${userId}\`, { limit: 30, window: "1 m" })`
 * dentro de una Server Action, antes de tocar el dominio.
 */
export async function rateLimit(
  identifier: string,
  { limit, window }: { limit: number; window: Window },
): Promise<void> {
  if (!redis) return; // sin Upstash configurado — no-op explícito, no un límite falso

  const key = identifier.split(":")[0] ?? identifier;
  const { success } = await getLimiter(key, limit, window).limit(identifier);
  if (!success) throw new RateLimitExceededError(identifier);
}
