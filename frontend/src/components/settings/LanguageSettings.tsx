import { Check, Languages } from "lucide-react";
import { LOCALES, LOCALE_NATIVE_NAMES, setLocale, useLocale, useT } from "../../i18n";
import type { Locale, TranslationKey } from "../../i18n";
import { Badge, PageHeader } from "../ui";

/**
 * Locale → key, spelled out instead of built from a template so the keys stay type-checked.
 * `Record<Locale, ...>` also means adding a language without its description fails the build.
 */
const OPTION_KEYS: Record<Locale, TranslationKey> = {
  es: "settings.language.option.es",
  en: "settings.language.option.en",
};

/** Settings → Language. Mirrors the theme picker: choosing applies immediately, no save button. */
export function LanguageSettings() {
  const t = useT();
  const locale = useLocale();

  return (
    <div>
      <PageHeader
        icon={Languages}
        title={t("settings.language.title")}
        description={t("settings.language.description")}
        actions={
          <Badge tone="accent">
            {t("settings.language.active")}: {LOCALE_NATIVE_NAMES[locale]}
          </Badge>
        }
      />
      <div className="language-grid grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t("settings.language.groupLabel")}>
        {LOCALES.map((id) => {
          const selected = id === locale;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setLocale(id)}
              className={`language-card cursor-pointer rounded-lg border p-4 text-left transition-all ${
                selected
                  ? "border-accent bg-bg-elevated-2 shadow-md"
                  : "border-border bg-bg-elevated hover:-translate-y-0.5 hover:border-border-strong hover:bg-bg-elevated-2"
              }`}
            >
              <span className="flex items-center justify-between">
                <span className="font-display text-base font-semibold text-text">{LOCALE_NATIVE_NAMES[id]}</span>
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full transition-colors ${
                    selected ? "bg-accent text-accent-contrast" : "bg-bg-hover text-transparent"
                  }`}
                >
                  <Check size={14} strokeWidth={3} />
                </span>
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-text-faint">{t(OPTION_KEYS[id])}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
