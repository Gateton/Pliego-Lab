import { en } from "./locales/en/index.ts";
import { es } from "./locales/es/index.ts";
import { LOCALES } from "./types.ts";
import type { Locale } from "./types.ts";

/**
 * Pure catalog access: no React, no DOM, no storage. The check script imports this module directly
 * under Node, so keeping it dependency-free is what lets the guard run with zero tooling.
 */
export const CATALOGS = { es, en } satisfies Record<Locale, typeof es>;

/** The shape every catalog must satisfy. Spanish defines it; see `locales/en/index.ts`. */
export type Catalog = typeof es;

/** Dot-path of every leaf key in the catalog, e.g. `"settings.language.title"`. */
type LeafPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafPaths<T[K]>}`;
}[keyof T & string];

export type TranslationKey = LeafPaths<Catalog>;

/**
 * Flattens a catalog to `dot.path` → value. Used by the runtime lookup and by `i18n-check`, which
 * is also why it is here rather than in the script: one definition, so the guard cannot disagree
 * with the app about what a key is.
 *
 * The result is kept per locale. It used to be rebuilt on every call, and since every `t()` goes
 * through `lookup`, a screen with hundreds of translated strings (the character library renders one
 * per tile, plus eight per card) spent most of a second re-walking a 1687-key catalog per render.
 * The catalogs are static modules, so the map can be shared for the life of the page.
 */
const flattenedCatalogs = new Map<Locale, Map<string, string>>();

export function flattenCatalog(locale: Locale): Map<string, string> {
  const cached = flattenedCatalogs.get(locale);
  if (cached) return cached;

  const flat = new Map<string, string>();
  const walk = (node: Record<string, unknown>, prefix: string) => {
    for (const [key, value] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "string") flat.set(path, value);
      else if (value && typeof value === "object") walk(value as Record<string, unknown>, path);
    }
  };
  walk(CATALOGS[locale], "");
  flattenedCatalogs.set(locale, flat);
  return flat;
}

/**
 * The same key in every locale. Used to recognise text the app itself seeded: an install created in
 * Spanish has the Spanish default stored, and that is not a rename by the user.
 */
export function translatedValues(key: TranslationKey): string[] {
  return LOCALES.map((locale) => lookup(locale, key)).filter((value): value is string => value !== undefined);
}

/** Resolves a dot-path against the live catalog. Returns undefined for a key that does not exist. */
export function lookup(locale: Locale, key: string): string | undefined {
  return flattenCatalog(locale).get(key);
}
