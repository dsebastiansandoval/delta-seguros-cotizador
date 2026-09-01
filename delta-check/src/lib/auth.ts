import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Google from "next-auth/providers/google";
import { env } from "./env";

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
  },
  callbacks: {
    /**
     * organizationId y roleCode viajan en el JWT/sesión para que
     * withOrganization() (src/db/index.ts) y requirePermission()
     * (src/domains/identity/services/rbac.service.ts) los lean sin volver
     * a golpear la base en cada request.
     */
    async jwt({ token, user }) {
      if (user) {
        // TODO(Fase 1): resolver organizationId real del usuario contra la
        // tabla users al iniciar sesión — placeholder hasta que exista el
        // flujo de onboarding/invitación.
        token.organizationId = (user as { organizationId?: string }).organizationId ?? null;
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
