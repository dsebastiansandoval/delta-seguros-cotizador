import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Apaga el ícono flotante de Next.js (info de ruta, solo visible en
  // `next dev`) — la demo corre en local con dev server, así que igual
  // aparecería frente a Diego si no se apaga acá.
  devIndicators: false,
  experimental: {
    // El CSV de tarifas de Salud (/admin/tarifas-salud) se sube por server action; el default
    // de 1 MB queda justo para BMI. 5 MB es el máximo que valida uploadHealthRates, + margen multipart.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
