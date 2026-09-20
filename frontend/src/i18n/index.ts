import { useSyncExternalStore } from "react";
import { lookup } from "./catalog.ts";
import type { TranslationKey } from "./catalog.ts";
import { isPseudoLocaleEnabled } from "./io.ts";
import { getLocale, subscribeToLocale } from "./state.ts";
import type { Locale } from "./types.ts";

/**
 * Interface translation. Usage:
 *
 *   const t = useT();              // inside a component: re-renders when the language changes
 *   t("settings.language.title")
 *
 *   import { t } from "../../i18n"; // in plain modules: evaluate it when the text is needed,
 *   t("chat.failed")                // never store the result in a module constant
 *
 * Keys are type-checked against the Spanish catalog, so a typo fails the build.
 */
export type TranslationVars = Record<string, string | number>;

export type TFunction = (key: TranslationKey, vars?: TranslationVars) => string;

const warnedKeys = new Set<string>();

function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/** `Intl.PluralRules` construction is not free, and plural keys are looked up during render. */
const pluralRules = new Map<Locale, Intl.PluralRules>();

/**
 * Plural selection, only when the caller passes a number as `count`. A key opts in by shipping
 * `key_one` / `key_other` variants; a key without them is used as-is. One and other are enough for
 * Spanish and English, and `Intl.PluralRules` keeps it correct if another language is added.
 */
function pluralKey(locale: Locale, key: string, count: number): string {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }
  const candidate = `${key}_${rules.select(count)}`;
  return lookup(locale, candidate) === undefined ? key : candidate;
}

export function t(key: TranslationKey, vars?: TranslationVars): string {
  const locale = getLocale();
  const count = vars?.count;
  let text = typeof count === "number" ? lookup(locale, pluralKey(locale, key, count)) : undefined;
  text ??= lookup(locale, key);
  if (text === undefined) {
    // The key is typed, so this can only happen if a catalog and the build disagree. Show the key
    // rather than an empty label, and report it once.
    if (!warnedKeys.has(key)) {
      warnedKeys.add(key);
      console.warn(`[i18n] missing key "${key}" in locale "${locale}"`);
    }
    text = key;
  }
  const rendered = interpolate(text, vars);
  return isPseudoLocaleEnabled() ? `⟦${rendered}⟧` : rendered;
}

/** Components use this so a language change re-renders them; the function itself is stable. */
export function useT(): TFunction {
  useSyncExternalStore(subscribeToLocale, getLocale, getLocale);
  return t;
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribeToLocale, getLocale, getLocale);
}

export { compareText, formatDate, formatDateTime, formatNumber } from "./format.ts";
export { getLocale, initLocale, setLocale, subscribeToLocale } from "./state.ts";
export { translatedValues } from "./catalog.ts";
export { isLocale, LOCALES, LOCALE_NATIVE_NAMES } from "./types.ts";
export type { TranslationKey } from "./catalog.ts";
export type { Locale } from "./types.ts";
