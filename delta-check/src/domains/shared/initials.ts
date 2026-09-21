/**
 * Iniciales para el avatar del topbar (mismo estilo del mockup — círculo
 * navy con 2 letras, ej. "RE" de "Richard Escobar"). Con nombre completo,
 * primera letra del primer y último nombre; sin nombre (cuenta nueva sin
 * `fullName`, o un provider que no lo mande), cae al correo.
 */
export function initialsFrom(fullName: string | null, email: string): string {
  const source = fullName?.trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}
