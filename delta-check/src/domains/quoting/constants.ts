/**
 * Rangos de Auto x Km — literales de `DATOS OFERTA X KM!E7:J7` del Excel
 * (EXCEL-AUDIT.md §2.2): "900 KM - 90 DÍAS", "1.500 KM - 120 DÍAS", etc.
 * Cada aseguradora cotiza un precio manual por rango, igual que hoy.
 */
export const KM_BRACKETS = [900, 1500, 3000, 5000, 7500, 10000] as const;
export type KmBracket = (typeof KM_BRACKETS)[number];

export const KM_BRACKET_LABELS: Record<KmBracket, string> = {
  900: "900 km — 90 días",
  1500: "1.500 km — 120 días",
  3000: "3.000 km — 150 días",
  5000: "5.000 km — 180 días",
  7500: "7.500 km — 270 días",
  10000: "10.000 km — 360 días",
};
