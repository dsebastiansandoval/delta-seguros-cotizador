import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Google from "next-auth/providers/google";
import { db } from "@/db";
import { users } from "@/db/schema/identity";
import { isAllowedMicrosoftEmail } from "@/domains/identity/microsoft-domain";
import { env } from "./env";

export { MICROSOFT_ALLOWED_DOMAIN } from "@/domains/identity/microsoft-domain";

/**
 * Providers según ARCHITECTURE.md §1/§11.3: Microsoft Entra ID (Delta ya
 * tiene tenant vía M365/Exchange), Google, y Email (magic link, pendiente
 * de configurar un servidor SMTP — se agrega cuando exista uno real).
 *
 * Cada provider se registra solo si sus credenciales están presentes — así
 * el proyecto arranca en local sin tenerlas todas, sin fingir que están
 * configuradas. Nunca se inventa un valor por defecto para un secreto.
 */
const providers: Provider[] = [];

if (env.AUTH_MICROSOFT_ENTRA_ID_ID && env.AUTH_MICROSOFT_ENTRA_ID_SECRET) {
  providers.push(
    MicrosoftEntraID({
      clientId: env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
  );
}

if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  );
}

/**
 * SOLO DESARROLLO — nunca debe llegar a producción. Microsoft/Google
 * todavía no tienen credenciales reales (ARCHITECTURE.md §11.3), y sin
 * esto no hay forma de probar el guard de sesión ni el flujo de cotización
 * en el navegador. Se registra con email únicamente (sin contraseña —
 * `credentials` acá no implica que se esté guardando ni comparando ninguna,
 * ver §6/§8.2: nunca se van a manejar contraseñas en texto plano) y solo
 * bajo `NODE_ENV === "development"`. Login real por Microsoft/Google apaga
 * esto automáticamente en cuanto haya credenciales — no hace falta borrarlo
 * a mano ni recordarse de quitarlo antes de deployar.
 */
if (process.env.NODE_ENV === "development") {
  providers.push(
    Credentials({
      id: "dev-login",
      name: "Desarrollo (solo local)",
      credentials: { email: { label: "Email", type: "email" } },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : null;
        if (!email) return null;
        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!user) return null;
        return { id: user.id, email: user.email, name: user.fullName };
      },
    }),
  );
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    /**
     * Filtro de dominio para Microsoft — Delta Check es multi-tenant
     * (ARCHITECTURE.md §1b), así que "cualquier cuenta de Microsoft válida"
     * no es suficiente: solo @deltaseguros.com.ec puede entrar por acá.
     * Además, igual que el provider de desarrollo (`if (!user) return
     * null`, más arriba), solo entra quien ya está sembrado en `users` — no
     * hay alta automática de cuenta nueva en el primer login, todavía no
     * existe una pantalla de administración de usuarios que la respalde.
     * Cada rechazo redirige a /login con un motivo distinto en vez del
     * "AccessDenied" genérico de Auth.js.
     */
    async signIn({ user, account }) {
      if (account?.provider !== "microsoft-entra-id") return true;

      if (!isAllowedMicrosoftEmail(user.email)) {
        return "/login?error=dominio";
      }

      const email = user.email!.toLowerCase();
      const [dbUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!dbUser) {
        return "/login?error=sin-acceso";
      }

      return true;
    },
    /**
     * organizationId viaja en el JWT para que withOrganization() y
     * requirePermission() lo lean sin volver a golpear la base en cada
     * request — solo se resuelve una vez, en el momento del login.
     *
     * La consulta acá NO pasa por withOrganization() porque en este punto
     * el tenant todavía no se conoce (es justo lo que se está resolviendo)
     * — ver el hueco de diseño documentado en ARCHITECTURE.md §8.3 sobre
     * el lookup de login bajo RLS. Hoy funciona porque el pool de conexión
     * local corre como superusuario; queda pendiente el rol `app_auth`
     * acotado para cuando eso deje de ser cierto.
     */
    async jwt({ token, user }) {
      if (user?.email) {
        const [dbUser] = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
        token.organizationId = dbUser?.organizationId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: { ...session.user, organizationId: token.organizationId ?? null },
      };
    },
  },
});

export type AppSession = { userId: string; organizationId: string | null; email: string; fullName: string | null };

/**
 * Auth.js v5 re-exporta `Session` con `export type {...} from
 * "@auth/core/types"` en vez de declararlo en el propio módulo `next-auth`
 * (verificado en node_modules/next-auth/index.d.ts) — un
 * `declare module "@auth/core/types" { interface Session {...} }` no logró
 * mergear el campo `organizationId` de forma confiable en este entorno
 * (Session extiende DefaultSession con cuerpo propio vacío, y la fusión con
 * ese patrón no se comportó como se esperaba). En vez de perseguir ese caso
 * límite de TypeScript, se centraliza acá: un solo cast, en un solo lugar,
 * documentado — el resto del código nunca vuelve a tocar `session.user`
 * crudo.
 */
export async function getAppSession(): Promise<AppSession | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  const user = session.user as { email: string; organizationId?: string | null; id?: string; name?: string | null };
  return {
    userId: user.id ?? user.email,
    organizationId: user.organizationId ?? null,
    email: user.email,
    fullName: user.name ?? null,
  };
}
