"""
Índice de modelos de PatioTuerca — los modelos/versiones que la guía de
precios realmente tiene, con su slug de URL, cuántas publicaciones tiene y
en qué años hay precio.

Fuente: la página pública https://ecuador.patiotuerca.com/precio trae
incrustado el catálogo que usa su propio cotizador (marca → modelo → años,
`brandModelCatalogByTipo`). No baja precios (eso sería scraping, ver
ARCHITECTURE.md §16): solo los nombres, para que el botón arme una URL que
exista. El slug de URL es el nombre sin tildes con todo lo que no sea letra
o número cambiado por "+" ("CX-5" → "cx+5", "C200" → "c200").

PatioTuerca no tiene una página por "modelo" a secas en muchos casos: tiene
versiones ("Corolla 1.8", "GLC 200", "Gol Power"), por eso guardamos
publicaciones y años — el link elige la versión más publicada con precio
para el año pedido.

Uso (desde la raíz del repo):
    python3 reference-data/extract_patiotuerca_index.py

Lee las marcas de reference-data/vehicle_models.json y escribe
delta-check/src/domains/shared/patiotuerca-index.generated.ts.
"""

import json
import re
import unicodedata
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODELS_JSON = ROOT / "reference-data" / "vehicle_models.json"
OUTPUT = ROOT / "delta-check" / "src" / "domains" / "shared" / "patiotuerca-index.generated.ts"
SOURCE = "https://ecuador.patiotuerca.com/precio"
# Tipos de la guía que cubren lo que cotiza Delta (autos + camiones/buses del catálogo).
TIPOS = ("autos", "pesados")


def slugify(value: str) -> str:
    plain = unicodedata.normalize("NFD", value)
    plain = "".join(c for c in plain if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", "+", plain).strip("+")


def fetch_catalog() -> dict:
    request = urllib.request.Request(SOURCE, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        html = response.read().decode("utf-8", errors="replace")
    # Next.js manda los datos de la página en trozos self.__next_f.push([1, "..."]).
    chunks = re.findall(r'self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)', html)
    payload = "".join(json.loads('"' + chunk + '"') for chunk in chunks)
    key = '"brandModelCatalogByTipo":'
    start = payload.index("{", payload.index(key) + len(key))
    catalog, _ = json.JSONDecoder().raw_decode(payload, start)
    return catalog


def build_index(catalog: dict) -> dict[str, dict[tuple[str, str], dict]]:
    """Marca (slug) → (tipo, slug de modelo) → nombre, publicaciones, años."""
    index: dict[str, dict[tuple[str, str], dict]] = {}
    for tipo in TIPOS:
        for brand in catalog[tipo]["brands"]:
            models = index.setdefault(slugify(brand["brand"]), {})
            for model in brand["models"]:
                slug = slugify(model["model"])
                if not slug:
                    continue
                # "T-Cross Trendline" y "T-Cross  Trendline" son la misma URL: se suman.
                entry = models.setdefault((tipo, slug), {"name": model["model"].strip(), "count": 0, "years": set()})
                entry["count"] += model.get("count", 0)
                entry["years"].update(model["years"])
    return index


def brand_aliases(brand: str, index: dict) -> list[str]:
    """"GREAT WALL (GWM)" → las marcas de PatioTuerca que existan entre great+wall+gwm, great+wall, gwm."""
    candidates = [slugify(brand), slugify(re.sub(r"\(.*?\)", "", brand))]
    inside = re.search(r"\((.*?)\)", brand)
    if inside:
        candidates.append(slugify(inside.group(1)))
    found = [c for c in candidates if c in index]
    return [c for i, c in enumerate(found) if c not in found[:i]]


def main() -> None:
    index = build_index(fetch_catalog())
    brands = list(json.loads(MODELS_JSON.read_text(encoding="utf-8")).keys())
    aliases = {brand: brand_aliases(brand, index) for brand in brands}
    for brand, slugs in aliases.items():
        print(f"{brand}: {', '.join(slugs) or '(no está en PatioTuerca)'}")

    lines = [
        f"// Generado por reference-data/extract_patiotuerca_index.py desde el catálogo público de {SOURCE}",
        "// — no editar a mano. Solo nombres, publicaciones y años con precio; ningún precio.",
        "",
        "/** [tipo, slug de URL, nombre en PatioTuerca, publicaciones, años con precio]. */",
        'export type PatioTuercaModel = [tipo: "autos" | "pesados", slug: string, name: string, count: number, years: number[]];',
        "",
        "/** Marca del catálogo de Delta → slugs de marca en PatioTuerca ([] = PatioTuerca no la tiene). */",
        "export const PATIOTUERCA_BRAND_ALIASES: Record<string, string[]> = {",
    ]
    for brand, slugs in aliases.items():
        lines.append(f"  {json.dumps(brand, ensure_ascii=False)}: {json.dumps(slugs)},")
    lines += ["};", "", "/** Slug de marca en PatioTuerca → sus modelos/versiones, más publicados primero. */",
              "export const PATIOTUERCA_MODELS: Record<string, PatioTuercaModel[]> = {"]
    for brand_slug in sorted(index):
        rows = sorted(index[brand_slug].items(), key=lambda item: (-item[1]["count"], item[0][1]))
        lines.append(f"  {json.dumps(brand_slug)}: [")
        for (tipo, slug), entry in rows:
            years = sorted(entry["years"], reverse=True)
            row = [tipo, slug, entry["name"], entry["count"], years]
            lines.append(f"    {json.dumps(row, ensure_ascii=False, separators=(',', ':'))},")
        lines.append("  ],")
    lines.append("};")
    OUTPUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    total = sum(len(models) for models in index.values())
    print(f"Escrito {OUTPUT.relative_to(ROOT)} — {len(index)} marcas, {total} modelos/versiones")


if __name__ == "__main__":
    main()
