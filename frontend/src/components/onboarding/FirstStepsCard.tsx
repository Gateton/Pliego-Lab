import { Check, CircleDot } from "lucide-react";
import { useT } from "../../i18n";
import type { TranslationKey } from "../../i18n";

export interface FirstStepsState {
  hasKey: boolean;
  hasPersona: boolean;
  hasCharacter: boolean;
  hasChat: boolean;
  onOpenWizard: () => void;
  onOpenPersonas: () => void;
  onOpenLibrary: () => void;
}

interface Item {
  id: string;
  labelKey: TranslationKey;
  done: boolean;
  action?: { labelKey: TranslationKey; run: () => void };
}

/**
 * Progress checklist for a fresh install, rendered in the empty chat. Every item is derived from
 * real state (provider key, personas, characters, chats) instead of stored flags, so it disappears
 * on its own once the user has actually started. Returns nothing when there is nothing left to do.
 */
export function FirstStepsCard({ state }: { state: FirstStepsState }) {
  const t = useT();
  const items: Item[] = [
    {
      id: "provider",
      labelKey: "onboarding.firstSteps.provider.label",
      done: state.hasKey,
      action: { labelKey: "onboarding.firstSteps.provider.action", run: state.onOpenWizard },
    },
    {
      id: "persona",
      labelKey: "onboarding.firstSteps.persona.label",
      done: state.hasPersona,
      action: { labelKey: "onboarding.firstSteps.persona.action", run: state.onOpenPersonas },
    },
    {
      id: "character",
      labelKey: "onboarding.firstSteps.character.label",
      done: state.hasCharacter,
      action: { labelKey: "onboarding.firstSteps.character.action", run: state.onOpenLibrary },
    },
    {
      id: "chat",
      labelKey: "onboarding.firstSteps.chat.label",
      done: state.hasChat,
      action: { labelKey: "onboarding.firstSteps.chat.action", run: state.onOpenLibrary },
    },
  ];

  if (items.every((item) => item.done)) return null;

  return (
    <div className="first-steps">
      <p className="first-steps__title">{t("onboarding.firstSteps.title")}</p>
      <ul>
        {items.map((item) => (
          <li key={item.id} className={item.done ? "is-done" : ""}>
            <span className="first-steps__mark" aria-hidden="true">
              {item.done ? <Check size={12} strokeWidth={3} /> : <CircleDot size={12} />}
            </span>
            <span className="first-steps__label">{t(item.labelKey)}</span>
            {!item.done && item.action && (
              <button type="button" onClick={item.action.run} className="first-steps__action">
                {t(item.action.labelKey)}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
