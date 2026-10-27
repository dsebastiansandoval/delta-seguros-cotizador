import { PATIOTUERCA_BRAND_ALIASES, PATIOTUERCA_MODELS, type PatioTuercaModel } from "./patiotuerca-index.generated";

/**
 * Enlace de referencia (no integración) a la guía de precios de PatioTuerca
 * — investigado en vivo, ver ARCHITECTURE.md §13.1/§16: el precio real
 * ("Precio ideal/más bajo/más alto") vive incrustado en el HTML de cada
 * página `/precio/{tipo}/{marca}/{modelo}/{año}`, no en una API pública.
 * Bajarlo por programa sería scraping — esto en cambio solo arma la URL
 * para que el agente la abra y la vea con sus propios ojos.
 *
 * PatioTuerca no escribe los modelos con una regla única ("CX-5", "C200",
 * "C-HR", "Trailblazer") y muchas veces no tiene el modelo a secas sino sus
 * versiones ("Corolla 1.8", "GLC 200", "Gol Power"). Por eso se compara
 * contra el catálogo que el sitio realmente tiene (PATIOTUERCA_MODELS,
 * generado por reference-data/extract_patiotuerca_index.py desde
 * /precio) ignorando separadores, y si hace falta se elige la versión más
 * publicada que tenga precio para el año pedido.
 */
export type PatioTuercaLink =
  | {
      kind: "MODEL";
      url: string;
      /** Nombre en PatioTuerca de la página abierta ("CX- 5 CORE"); null si la URL se armó sin catálogo. */
      name: string | null;
      /** false si se abrió una versión o un modelo parecido, no el escrito. */
      exact: boolean;
      /** false si PatioTuerca no lista precio para ese año — la página puede salir vacía. */
      yearListed: boolean;
      /** Años con precio en PatioTuerca, más cercanos al pedido primero; vacío si la URL se armó sin catálogo. */
      nearestYears: number[];
    }
  | { kind: "BRAND"; url: string }
  | { kind: "UNAVAILABLE" };

const BASE = "https://ecuador.patiotuerca.com/precio/";

/** Sin tildes, minúsculas, todo lo que no sea letra o número → "+". "RÍO" → "rio", "Corolla 1.2" → "corolla+1+2". */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "+")
    .replace(/^\++|\++$/g, "");
}

const compact = (slug: string) => slug.replace(/\+/g, "");

/**
 * ¿El texto se puede cortar justo después de sus primeras `chars` letras/números?
 * Solo en un separador: "fortuner+2g" se corta en "fortuner", "wingle5" no se
 * corta en "wingle" — ahí el número pegado es otro modelo, no una versión.
 */
function cutsAtSeparator(slug: string, chars: number): boolean {
  let seen = 0;
  for (let i = 0; i < slug.length; i++) {
    if (slug[i] === "+") continue;
    if (++seen === chars) return slug[i + 1] === "+";
  }
  return false;
}

/** Variantes de un nombre: tal cual, sin "NEW/NUEVO/ALL NEW", sin la marca pegada ("MAZDA3" → "3", "Mazda 3 High" → "3+high"). */
function variants(slug: string, brandSlug: string): string[] {
  const list = [slug];
  const withoutNew = slug.replace(/^(all\+new|nuevo|nueva|new)\+?/, "");
  if (withoutNew && withoutNew !== slug) list.push(withoutNew);
  for (const word of brandSlug.split("+")) {
    for (const s of [...list]) {
      const rest = s.startsWith(word) ? s.slice(word.length).replace(/^\+/, "") : "";
      if (rest) list.push(rest);
    }
  }
  return [...new Set(list)];
}

/**
 * El campo "Modelo" suele traer la ficha técnica completa ("301 ALL 1.6E B5
 * AC 1.6 4P 4X2 TM"); si empieza con una entrada real del catálogo
 * (`knownModels`, el mismo que llena el datalist), se usa esa entrada. El
 * match más largo gana ("CX30" no se recorta a "CX3").
 */
function resolveModelBase(model: string, knownModels: string[]): string {
  const normalized = model.trim().toUpperCase();
  const match = knownModels
    .map((known) => known.trim())
    .filter((known) => {
      const upper = known.toUpperCase();
      return normalized === upper || normalized.startsWith(`${upper} `);
    })
    .sort((a, b) => b.length - a.length)[0];
  return match ?? model;
}

/** Qué tan cerca está un modelo de PatioTuerca del texto escrito (menor = más cerca). */
enum Fit {
  /** Mismo modelo, separado distinto: "CX5" = "CX-5", "CHR" = "C-HR". */
  SAME = 0,
  /** El texto es una versión de este modelo: "CX30 2.5L AT" → "CX-30", "FORTUNER 2G" → "Fortuner". */
  BASE = 1,
  /** Una versión del modelo, cuando PatioTuerca no tiene el modelo a secas: "COROLLA" → "Corolla 1.8". */
  VERSION = 2,
}

/** Mejor ajuste entre las variantes del texto y las de un modelo de PatioTuerca, con cuántas letras/números coinciden. */
function fitOf(input: string[], theirs: string[]): { fit: Fit; length: number } | null {
  let best: { fit: Fit; length: number } | null = null;
  for (const mine of input) {
    const a = compact(mine);
    for (const slug of theirs) {
      const b = compact(slug);
      let fit: Fit | null = null;
      if (a === b) fit = Fit.SAME;
      else if (a.startsWith(b) && cutsAtSeparator(mine, b.length)) fit = Fit.BASE;
      else if (b.startsWith(a) && cutsAtSeparator(slug, a.length)) fit = Fit.VERSION;
      if (fit !== null && (!best || fit < best.fit || (fit === best.fit && b.length > best.length))) best = { fit, length: b.length };
    }
  }
  return best;
}

type Match = { brandSlug: string; model: PatioTuercaModel; fit: Fit; length: number };

/**
 * Elige la página: el ajuste más cercano primero — PatioTuerca muestra
 * precio del modelo exacto aun en años que no lista (promedia con años
 * vecinos), y una versión con el año ("Golf GTI") puede valer muy distinto
 * que el modelo ("Golf"). Dentro del mismo ajuste: con precio para el año,
 * el más específico ("Yaris Cross" antes que "Yaris") y el más publicado.
 */
function pickModel(matches: Match[], year: number, modelSlug: string): Match | null {
  const listed = (m: Match) => (m.model[4].includes(year) ? 0 : 1);
  // Entre "Santa Fe" y "New Santa Fe" (mismo modelo), el escrito tal cual — si los dos tienen precio ese año.
  const literal = (m: Match) => (compact(m.model[1]) === compact(modelSlug) ? 0 : 1);
  const specific = (a: Match, b: Match) => (a.fit === Fit.BASE ? b.length - a.length : 0);
  return (
    [...matches].sort(
      (a, b) => a.fit - b.fit || listed(a) - listed(b) || literal(a) - literal(b) || specific(a, b) || b.model[3] - a.model[3],
    )[0] ?? null
  );
}

/** null si falta marca, modelo o un año de 4 dígitos. */
export function buildPatioTuercaLink(brand: string, model: string, year: string, knownModels: string[] = []): PatioTuercaLink | null {
  const y = year.trim();
  const base = resolveModelBase(model, knownModels);
  const baseSlug = slugify(base);
  if (!slugify(brand) || !baseSlug || !/^\d{4}$/.test(y)) return null;

  const catalogBrand = Object.keys(PATIOTUERCA_BRAND_ALIASES).find((name) => slugify(name) === slugify(brand));
  const brandSlugs = catalogBrand ? PATIOTUERCA_BRAND_ALIASES[catalogBrand] : PATIOTUERCA_MODELS[slugify(brand)] ? [slugify(brand)] : null;
  // Marca fuera del catálogo y de PatioTuerca (texto libre): sin contra qué comparar, se arma la URL directo.
  if (!brandSlugs) {
    return { kind: "MODEL", url: `${BASE}autos/${slugify(brand)}/${baseSlug}/${y}`, name: null, exact: true, yearListed: false, nearestYears: [] };
  }
  if (!brandSlugs.length) return { kind: "UNAVAILABLE" };

  // Otros modelos del catálogo que empiezan igual: las versiones de "COROLLA CROSS" o "TIGGO2" no son de "COROLLA" ni de "TIGGO",
  // y "Yaris" no es la base de "YARIS CROSS HEV" si "YARIS CROSS" es otro modelo.
  const knownSlugs = knownModels.map(slugify).filter((k) => k !== baseSlug);
  const longerKnown = knownSlugs.filter((k) => compact(k).length > compact(baseSlug).length && compact(k).startsWith(compact(baseSlug)));
  const shorterKnown = knownSlugs.filter((k) => fitOf([baseSlug], [k])?.fit === Fit.BASE);

  const matches: Match[] = [];
  for (const brandSlug of brandSlugs) {
    const input = variants(baseSlug, brandSlug);
    for (const entry of PATIOTUERCA_MODELS[brandSlug] ?? []) {
      const theirs = variants(entry[1], brandSlug);
      const found = fitOf(input, theirs);
      if (!found) continue;
      if (found.fit === Fit.VERSION && longerKnown.some((k) => fitOf(variants(k, brandSlug), theirs))) continue;
      if (found.fit === Fit.BASE && shorterKnown.some((k) => fitOf(variants(k, brandSlug), theirs)?.fit === Fit.BASE)) continue;
      matches.push({ brandSlug, model: entry, ...found });
    }
  }

  const match = pickModel(matches, Number(y), baseSlug);
  if (!match) return { kind: "BRAND", url: `${BASE}autos/${brandSlugs[0]}` };
  const [tipo, slug, name, , years] = match.model;
  return {
    kind: "MODEL",
    url: `${BASE}${tipo}/${match.brandSlug}/${slug}/${y}`,
    name,
    exact: match.fit === Fit.SAME,
    yearListed: years.includes(Number(y)),
    nearestYears: [...years].sort((a, b) => Math.abs(a - Number(y)) - Math.abs(b - Number(y)) || b - a),
  };
}
