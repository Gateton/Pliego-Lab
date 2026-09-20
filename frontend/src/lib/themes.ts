/**
 * The theme ids and their swatches. The name and the description are interface copy: they live in
 * the catalogs under `settings.themes.item.<id>.name` / `.description` and are resolved by the
 * picker, which is the component that knows the language. Ids are identifiers and never change.
 */
export const APP_THEMES = [
  { id: "gateton", colors: ["#100f14", "#ee9d9f", "#d7b781"] },
  { id: "medianoche", colors: ["#080d17", "#7aa2d6", "#a9c7e8"] },
  { id: "bosque", colors: ["#0c120f", "#8eae91", "#c2a875"] },
  { id: "vino", colors: ["#160c10", "#cf7f8e", "#d5ad79"] },
  { id: "ambar", colors: ["#15110c", "#d49a61", "#e0c28d"] },
  { id: "papel", colors: ["#eee8de", "#a95858", "#84672f"] },
] as const;

export type AppThemeId = (typeof APP_THEMES)[number]["id"];

export const DEFAULT_THEME: AppThemeId = "gateton";
export const THEME_STORAGE_KEY = "pl.interfaceTheme";

export function isAppTheme(value: string | null): value is AppThemeId {
  return APP_THEMES.some((theme) => theme.id === value);
}
