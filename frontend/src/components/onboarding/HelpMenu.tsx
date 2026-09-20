import { HelpCircle, Keyboard, Sparkles, Route } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "../../i18n";
import { SLASH_COMMANDS } from "../../lib/composerCommands";

interface Props {
  onOpenGuide: () => void;
  onOpenWizard: () => void;
}

/**
 * Permanent way back into the onboarding: the guide, the initial setup and the keyboard shortcuts
 * the composer understands. Mirrors the top bar "⋮" dropdown so the two behave the same.
 */
export function HelpMenu({ onOpenGuide, onOpenWizard }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={t("chrome.topbar.help")}
        aria-label={t("chrome.topbar.help")}
        aria-expanded={open}
        data-tour="btn-help"
        className={`topbar-action flex cursor-pointer items-center ${open ? "bg-bg-hover text-text" : ""}`}
      >
        <HelpCircle size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-lg border border-border bg-bg-elevated shadow-md">
          <button
            onClick={() => {
              setOpen(false);
              onOpenGuide();
            }}
            className="flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left text-sm text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
          >
            <Route size={15} className="mt-0.5 shrink-0" />
            <span>
              {t("onboarding.help.openGuide")}
              <span className="mt-0.5 block text-xs text-text-faint">{t("onboarding.help.openGuideHint")}</span>
            </span>
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onOpenWizard();
            }}
            className="flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left text-sm text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
          >
            <Sparkles size={15} className="mt-0.5 shrink-0" />
            <span>
              {t("onboarding.initialSetup")}
              <span className="mt-0.5 block text-xs text-text-faint">{t("onboarding.help.openWizardHint")}</span>
            </span>
          </button>
          <div className="border-t border-border px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-text">
              <Keyboard size={13} />
              {t("onboarding.help.shortcuts.title")}
            </p>
            <ul className="mt-1.5 grid gap-1 text-xs text-text-faint">
              <li>
                <code>{t("onboarding.help.keys.enter")}</code> {t("onboarding.help.shortcuts.send")}{" "}
                <code>{t("onboarding.help.keys.shiftEnter")}</code> {t("onboarding.help.shortcuts.lineBreak")}
              </li>
              <li>
                <code>@</code> {t("onboarding.help.shortcuts.mention")}
              </li>
              {SLASH_COMMANDS.map((command) => (
                <li key={command.command}>
                  <code>{command.command}</code> {t(command.descriptionKey)}
                </li>
              ))}
              <li>
                <code>{t("onboarding.help.keys.escape")}</code> {t("onboarding.help.shortcuts.closePanel")}
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
