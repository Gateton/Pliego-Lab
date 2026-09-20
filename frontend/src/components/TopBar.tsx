import { useCallback, useEffect, useRef, useState } from "react";
import { BookMarked, BookOpen, Coins, Download, Film, Image as ImageIcon, Library, MoreVertical, PanelLeft, ScanSearch, Settings, SlidersHorizontal, UserCircle, Wand2, Zap } from "lucide-react";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import type { ModalId } from "../App";
import { useT } from "../i18n";
import type { TranslationKey } from "../i18n";
import { HelpMenu } from "./onboarding/HelpMenu";

interface Props {
  onOpen: (modal: Exclude<ModalId, null>) => void;
  onOpenPrompts: () => void;
  onOpenLibrary: () => void;
  /** "Uso y costos" is OpenRouter-only (the only provider with real pricing/cost). */
  usageEnabled: boolean;
  /** Controlled "⋮" menu, so the first-run guide can open it. Uncontrolled when omitted. */
  menuOpen?: boolean;
  onMenuChange?: (open: boolean) => void;
  onOpenGuide: () => void;
  onOpenWizard: () => void;
}

interface TopButtonProps {
  icon: ComponentType<LucideProps>;
  label: string;
  onClick: () => void;
  featured?: boolean;
  /** Anchor for the first-run guide. Optional so existing callers stay unchanged. */
  tourId?: string;
}

function TopButton({ icon: Icon, label, onClick, featured = false, tourId }: TopButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      data-tour={tourId}
      className={`topbar-action flex cursor-pointer items-center gap-1.5 text-xs font-semibold ${featured ? "topbar-action--featured" : ""}`}
    >
      <Icon size={15} />
      <span>{label}</span>
    </button>
  );
}

const OVERFLOW_ITEMS: { id: Exclude<ModalId, null>; labelKey: TranslationKey; icon: ComponentType<LucideProps>; tourId: string }[] = [
  { id: "importst", labelKey: "chrome.feature.importSt", icon: Download, tourId: "menu-importst" },
  { id: "settings", labelKey: "chrome.feature.settings", icon: Settings, tourId: "menu-settings" },
];

export function TopBar({ onOpen, onOpenPrompts, onOpenLibrary, usageEnabled, menuOpen, onMenuChange, onOpenGuide, onOpenWizard }: Props) {
  const t = useT();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isControlled = menuOpen !== undefined;
  const open = isControlled ? menuOpen : uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onMenuChange?.(next);
    },
    [isControlled, onMenuChange],
  );

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [setOpen]);

  return (
    <header className="topbar flex shrink-0 items-center justify-between">
      <div className="topbar__brand" data-tour="brand">
        <div className="topbar__logo-wrap" aria-hidden="true">
          <img src="/logo.png" alt="" className="topbar__logo" />
        </div>
        <div className="topbar__wordmark">
          <span className="topbar__name">{t("common.appName")}</span>
          <span className="topbar__tagline">{t("chrome.brand.tagline")}</span>
        </div>
      </div>

      <nav className="topbar__actions" aria-label={t("chrome.topbar.mainNav")} data-tour="topbar-actions">
        <button className="mobile-nav-action topbar-action cursor-pointer" onClick={onOpenPrompts} title={t("chrome.topbar.openResponsePanel")} aria-label={t("chrome.topbar.openResponsePanel")}>
          <PanelLeft size={16} />
        </button>
        <button className="mobile-nav-action topbar-action cursor-pointer" onClick={onOpenLibrary} title={t("chrome.topbar.openLibrary")} aria-label={t("chrome.topbar.openLibrary")}>
          <Library size={16} />
        </button>
        <TopButton icon={SlidersHorizontal} label={t("chrome.feature.presets")} onClick={() => onOpen("presets")} tourId="btn-presets" />
        <TopButton icon={UserCircle} label={t("chrome.feature.personas")} onClick={() => onOpen("personas")} tourId="btn-personas" />
        <TopButton icon={BookMarked} label={t("chrome.feature.lorebooks")} onClick={() => onOpen("lorebooks")} featured tourId="btn-lorebooks" />
        <TopButton icon={Wand2} label={t("chrome.feature.characterCreator")} onClick={() => onOpen("character-creator")} tourId="btn-character-creator" />
        <div className="topbar__divider" aria-hidden="true" />
        <TopButton icon={Film} label={t("chrome.feature.director")} onClick={() => onOpen("director")} tourId="btn-director" />
        <TopButton icon={BookOpen} label={t("chrome.feature.estudio")} onClick={() => onOpen("estudio")} featured tourId="btn-estudio" />
        <TopButton icon={Zap} label={t("chrome.feature.gatetonRp")} onClick={() => onOpen("gateton-roleplay")} featured tourId="btn-gateton-rp" />
        <TopButton icon={ImageIcon} label={t("chrome.feature.comfyInject")} onClick={() => onOpen("comfyinject")} tourId="btn-comfyinject" />
        {usageEnabled && <TopButton icon={Coins} label={t("chrome.feature.usage")} onClick={() => onOpen("usage")} tourId="btn-usage" />}
        <TopButton icon={Wand2} label={t("chrome.feature.recast")} onClick={() => onOpen("recast")} tourId="btn-recast" />
        <TopButton icon={ScanSearch} label={t("chrome.feature.npcs")} onClick={() => onOpen("npc")} tourId="btn-npc" />

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen(!open)}
            title={t("chrome.topbar.moreTools")}
            aria-label={t("chrome.topbar.moreTools")}
            aria-expanded={open}
            data-tour="menu-more"
            className={`topbar-action flex cursor-pointer items-center ${
              open ? "bg-bg-hover text-text" : ""
            }`}
          >
            <MoreVertical size={15} />
          </button>
          {open && (
            <div className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-bg-elevated shadow-md">
              {OVERFLOW_ITEMS.map((it) => {
                const Icon = it.icon;
                return (
                  <button
                    key={it.id}
                    data-tour={it.tourId}
                    onClick={() => {
                      onOpen(it.id);
                      setOpen(false);
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
                  >
                    <Icon size={15} />
                    {t(it.labelKey)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <HelpMenu onOpenGuide={onOpenGuide} onOpenWizard={onOpenWizard} />
      </nav>
    </header>
  );
}
