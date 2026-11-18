import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Logos de las aseguradoras de Salud, extraídos de `COTIZADOR
 * ACTUALIZADO.xlsm` (hoja DATOS AM y las hojas propias BUPA/CONFIAMED/
 * HUMANA/PRO/VB — recortados a su bounding box real, sin el badge de
 * "Vitality" que trae pegado el de SaludSA en el Excel) — mismos logos que
 * ya usa Delta en el PDF real que manda al cliente.
 *
 * `SALUD` (planes STAR) y `SALUDSA` comparten el mismo logo en el libro:
 * las hojas SALUD y SALUDSA recortan ambas `xl/media/image165.png`, y en
 * OFERTA AM todos esos planes usan el mismo recorte. Por eso `SALUD` apunta
 * al PNG de SALUDSA — antes no estaba en este mapa y la carátula caía al
 * nombre en texto en vez del logo.
 */
const INSURER_LOGO_ASSETS: Record<string, { file: string; aspect: number }> = {
  BMI: { file: "BMI.png", aspect: 456 / 181 },
  HUMANA: { file: "HUMANA.png", aspect: 351 / 102 },
  CONFIAMED: { file: "CONFIAMED.png", aspect: 382 / 113 },
  SALUD: { file: "SALUDSA.png", aspect: 432 / 103 },
  SALUDSA: { file: "SALUDSA.png", aspect: 432 / 103 },
  BUPA: { file: "BUPA.png", aspect: 337 / 137 },
  PRO: { file: "PRO.png", aspect: 426 / 101 },
  VB: { file: "VB.png", aspect: 448 / 117 },
};

const INSURER_LOGOS: Record<string, Buffer> = Object.fromEntries(
  Object.entries(INSURER_LOGO_ASSETS).map(([code, asset]) => [
    code,
    readFileSync(join(process.cwd(), `src/domains/health/pdf/assets/insurer-logos/${asset.file}`)),
  ]),
);

export function insurerLogo(code: string): { src: Buffer; aspect: number } | null {
  const asset = INSURER_LOGO_ASSETS[code];
  return asset ? { src: INSURER_LOGOS[code], aspect: asset.aspect } : null;
}
