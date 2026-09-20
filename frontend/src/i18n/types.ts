/**
 * The interface locales. This list is the single source of truth: adding a language means adding a
 * catalog under `locales/`, one entry here, and nothing else. No component knows the difference.
 */
export const LOCALES = ["es", "en"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * Language names stay in their own language and are deliberately kept out of the catalogs: someone
 * looking for Spanish has to find "Español", not "Spanish". Translating this list is the one way
 * to make a language picker unusable.
 */
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  es: "Español",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
