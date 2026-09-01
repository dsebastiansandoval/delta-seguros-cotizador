import type { DefaultSession } from "next-auth";

// Amplía el tipo de sesión de Auth.js con el tenant del usuario — el campo
// que withOrganization() y requirePermission() leen en cada request
// (ARCHITECTURE.md §1b). Sin esto, session.user.organizationId no tipa.
declare module "next-auth" {
  interface Session {
    user: {
      organizationId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    organizationId?: string | null;
  }
}
