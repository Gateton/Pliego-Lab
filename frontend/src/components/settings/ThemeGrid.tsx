import { Check } from "lucide-react";
import { useT } from "../../i18n";
import type { TranslationKey } from "../../i18n";
import { APP_THEMES, type AppThemeId } from "../../lib/themes";

/**
 * Theme id → catalog keys, spelled out instead of built from a template so the keys stay
 * type-checked. `Record<AppThemeId, ...>` also means adding a theme without its copy fails the build.
 */
const THEME_KEYS: Record<AppThemeId, { nameKey: TranslationKey; descriptionKey: TranslationKey }> = {
  gateton: { nameKey: "settings.themes.item.gateton.name", descriptionKey: "settings.themes.item.gateton.description" },
  medianoche: { nameKey: "settings.themes.item.medianoche.name", descriptionKey: "settings.themes.item.medianoche.description" },
  bosque: { nameKey: "settings.themes.item.bosque.name", descriptionKey: "settings.themes.item.bosque.description" },
  vino: { nameKey: "settings.themes.item.vino.name", descriptionKey: "settings.themes.item.vino.description" },
  ambar: { nameKey: "settings.themes.item.ambar.name", descriptionKey: "settings.themes.item.ambar.description" },
  papel: { nameKey: "settings.themes.item.papel.name", descriptionKey: "settings.themes.item.papel.description" },
};

interface Props {
  value: AppThemeId;
  onChange: (theme: AppThemeId) => void;
  /** Extra class names for the grid container (the wizard wants a tighter layout). */
  className?: string;
}

/** Theme picker. Shared by Settings and the first-run wizard so both stay in sync. */
export function ThemeGrid({ value, onChange, className = "" }: Props) {
  const t = useT();

  return (
    <div
      className={`theme-grid mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${className}`}
      role="radiogroup"
      aria-label={t("settings.themes.gridLabel")}
    >
      {APP_THEMES.map((theme) => {
        const selected = theme.id === value;
        const keys = THEME_KEYS[theme.id];
        return (
          <button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(theme.id)}
            className={`theme-card group relative cursor-pointer overflow-hidden rounded-lg border p-4 text-left transition-all ${
              selected
                ? "border-accent bg-bg-elevated-2 shadow-md"
                : "border-border bg-bg-elevated hover:-translate-y-0.5 hover:border-border-strong hover:bg-bg-elevated-2"
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="flex gap-1.5" aria-hidden="true">
                {theme.colors.map((color) => (
                  <span key={color} className="h-7 w-7 rounded-md border border-white/10 shadow-sm" style={{ backgroundColor: color }} />
                ))}
              </span>
              <span className={`grid h-6 w-6 place-items-center rounded-full transition-colors ${selected ? "bg-accent text-accent-contrast" : "bg-bg-hover text-transparent"}`}>
                <Check size={14} strokeWidth={3} />
              </span>
            </div>
            <span className="block font-display text-base font-semibold text-text">{t(keys.nameKey)}</span>
            <span className="mt-1 block text-xs leading-relaxed text-text-faint">{t(keys.descriptionKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
