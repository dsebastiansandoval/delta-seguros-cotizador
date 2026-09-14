import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Apaga el ícono flotante de Next.js (info de ruta, solo visible en
  // `next dev`) — la demo corre en local con dev server, así que igual
  // aparecería frente a Diego si no se apaga acá.
  devIndicators: false,
};

export default nextConfig;
