import { getLocale } from "./state.ts";

/**
 * Dates and numbers go through the browser's own locale data. Never hardcode `"es-AR"` or `"es"` in
 * a component: a formatted number is interface copy like any other.
 */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(getLocale(), options).format(value);
}

export function formatDate(value: Date | number, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(getLocale(), options).format(value);
}

export function formatDateTime(value: Date | number): string {
  return formatDate(value, { dateStyle: "short", timeStyle: "short" });
}

/**
 * Alphabetical order for names the person reads. Plain `<` sorts by code point, which puts "Ávila"
 * after "Zeta"; the active locale knows better.
 */
export function compareText(left: string, right: string): number {
  return new Intl.Collator(getLocale()).compare(left, right);
}
