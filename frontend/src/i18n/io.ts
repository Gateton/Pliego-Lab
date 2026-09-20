import { isLocale, type Locale } from "./types.ts";

export const LOCALE_STORAGE_KEY = "pl.uiLanguage";
export const PSEUDO_LOCALE_STORAGE_KEY = "pl.debugPseudoLocale";

/**
 * New installs fall back to English: this is a public project, and defaulting to Spanish would be
 * deciding the interface language on the user's behalf.
 */
export const DEFAULT_LOCALE: Locale = "en";

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private mode / no storage: the preference just does not survive the session.
    return null;
  }
}

/** The saved preference, or null when this browser never chose one. */
export function readStoredLocale(): Locale | null {
  const raw = readStorage(LOCALE_STORAGE_KEY);
  return isLocale(raw) ? raw : null;
}

export function persistLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Same as above: losing the preference is not worth failing a render over.
  }
}

/**
 * Saved preference, else the browser's own language, else `en`. The stored value wins so that
 * changing the language is final, and nothing flips it back on the next visit.
 */
export function detectLocale(): Locale {
  const stored = readStoredLocale();
  if (stored) return stored;
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of tags) {
    const base = tag?.toLowerCase().split("-")[0];
    if (base === "es") return "es";
    if (base === "en") return "en";
  }
  return DEFAULT_LOCALE;
}

/** Keeps `<html lang>` honest for assistive tech and the browser's own hyphenation/quotes. */
export function applyDocumentLocale(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
}

/**
 * QA switch: with `pl.debugPseudoLocale = "1"` every translated string comes back wrapped in ⟦…⟧.
 * Anything visible without markers is copy that was never migrated. It is the only reliable way to
 * audit "the whole interface" without reading every file.
 */
export function isPseudoLocaleEnabled(): boolean {
  return readStorage(PSEUDO_LOCALE_STORAGE_KEY) === "1";
}
