import { applyDocumentLocale, detectLocale, persistLocale } from "./io.ts";
import type { Locale } from "./types.ts";

/**
 * The live locale. Module state rather than React context on purpose: `t()` has to work in plain
 * modules (`lib/`, `api/`, error helpers), where there is no provider to read from. Components
 * subscribe through `useT()` / `useLocale()` instead of drilling props.
 */
let locale: Locale = detectLocale();

const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return locale;
}

export function setLocale(next: Locale): void {
  if (next === locale) return;
  locale = next;
  persistLocale(next);
  applyDocumentLocale(next);
  for (const listener of listeners) listener();
}

export function subscribeToLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Applies the resolved locale to the document before the first render. Called from main.tsx. */
export function initLocale(): void {
  applyDocumentLocale(locale);
}
