// Amplía el JWT de Auth.js con el tenant del usuario (ARCHITECTURE.md §1b).
// Esta fusión sí aplica de forma confiable (a diferencia de `Session`, ver
// el comentario en getAppSession() dentro de src/lib/auth.ts — ahí se
// explica por qué ese caso se resolvió con un cast centralizado en vez de
// con augmentación de tipos).
declare module "next-auth/jwt" {
  interface JWT {
    organizationId?: string | null;
  }
}
