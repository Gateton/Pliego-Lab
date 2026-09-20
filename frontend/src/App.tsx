import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useChat } from "./hooks/useChat";
import { useChatList } from "./hooks/useChatList";
import { useProviders } from "./hooks/useProviders";
import { useCharacters } from "./hooks/useCharacters";
import { usePersonas } from "./hooks/usePersonas";
import { useSettings } from "./hooks/useSettings";
import { useComfyInjectSettings } from "./hooks/useComfyInjectSettings";
import { usePersistedBoolean } from "./hooks/usePersistedBoolean";
import { usePersistedNumber } from "./hooks/usePersistedNumber";
import * as settingsApi from "./api/settings";
import { TopBar } from "./components/TopBar";
import { LeftSidebar, type LeftTab } from "./components/LeftSidebar";
import { RightPanel } from "./components/RightPanel";
import { ChatView } from "./components/ChatView";
import { ResizeHandle } from "./components/ResizeHandle";
import { ConfigOverlay } from "./components/ConfigOverlay";
import { EstudioPanel } from "./components/estudio/EstudioPanel";
import { SamplingPresetManager } from "./components/presets/SamplingPresetManager";
import { ComfyInjectSettings } from "./components/settings/ComfyInjectSettings";
import { RecastSettings } from "./components/settings/RecastSettings";
import { RecastPresetManager } from "./components/presets/RecastPresetManager";
import { SillyTavernImportPanel } from "./components/settings/SillyTavernImportPanel";
import { ThemeSettings } from "./components/settings/ThemeSettings";
import { LanguageSettings } from "./components/settings/LanguageSettings";
import { MemoryOverview } from "./components/settings/MemoryOverview";
import { PersonaManager } from "./components/personas/PersonaManager";
import { CharacterEditor } from "./components/characters/CharacterEditor";
import { CharacterCreator } from "./components/characters/CharacterCreator";
import { NpcTrackerSettingsPanel } from "./components/npc/NpcTrackerSettingsPanel";
import { GatetonRoleplay } from "./components/gateton-roleplay/GatetonRoleplay";
import { DirectorModuleContent } from "./components/gateton-roleplay/modules/DirectorModule";
import { UsageDashboard } from "./components/usage/UsageDashboard";
import { LorebookStudio } from "./components/lorebooks/LorebookStudio";
import { Modal } from "./components/ui";
import { FirstRunWizard } from "./components/onboarding/FirstRunWizard";
import { GuideSettings } from "./components/onboarding/GuideSettings";
import { isTourPending, isWizardPending, readOnboardingQa, TOUR_VERSION, WIZARD_VERSION } from "./components/onboarding/onboardingState";
import { OnboardingTour } from "./components/tour/OnboardingTour";
import { buildTourSteps } from "./components/tour/tourSteps";
import type { TourContext } from "./components/tour/tour.types";
import { DEFAULT_THEME, isAppTheme, THEME_STORAGE_KEY, type AppThemeId } from "./lib/themes";
import { getUserCharacters } from "./lib/characterVisibility";
import { useLocale, useT } from "./i18n";
import type { TranslationKey } from "./i18n";

export type ModalId =
  | "presets"
  | "estudio"
  | "gateton-roleplay"
  | "npc"
  | "comfyinject"
  | "usage"
  | "recast"
  | "importst"
  | "settings"
  | "personas"
  | "character-creator"
  | "director"
  | "lorebooks"
  | null;

/** Key per modal, resolved with `t()` where the overlay is rendered so it follows the language. */
const MODAL_TITLES: Record<Exclude<ModalId, null>, TranslationKey> = {
  presets: "chrome.modal.presets",
  estudio: "chrome.modal.estudio",
  "gateton-roleplay": "chrome.modal.gatetonRoleplay",
  npc: "chrome.modal.npc",
  comfyinject: "chrome.modal.comfyInject",
  usage: "chrome.modal.usage",
  recast: "chrome.modal.recast",
  importst: "chrome.modal.importSt",
  settings: "chrome.modal.settings",
  personas: "chrome.modal.personas",
  "character-creator": "chrome.modal.characterCreator",
  director: "chrome.modal.director",
  lorebooks: "chrome.modal.lorebooks",
};

/** Thin vertical strip shown when a side panel is collapsed — click it to re-expand. */
function CollapsedRail({ side, onExpand }: { side: "left" | "right"; onExpand: () => void }) {
  const t = useT();
  const label = t(side === "left" ? "chrome.panel.showResponse" : "chrome.panel.showCharacters");
  return (
    <button
      onClick={onExpand}
      title={label}
      aria-label={label}
      className={`collapsed-rail flex shrink-0 flex-col items-center border-border bg-bg-elevated pt-2 ${
        side === "left" ? "border-r" : "border-l"
      }`}
    >
      {side === "left" ? <ChevronRight size={16} className="text-text-faint" /> : <ChevronLeft size={16} className="text-text-faint" />}
    </button>
  );
}

function App() {
  const t = useT();
  const narrowViewport = typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches;
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalId>(null);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [charactersVersion, setCharactersVersion] = useState(0);
  const [leftCollapsed, setLeftCollapsed] = usePersistedBoolean("pl.leftPanelCollapsed", narrowViewport);
  const [rightCollapsed, setRightCollapsed] = usePersistedBoolean("pl.rightPanelCollapsed", narrowViewport);
  const [leftWidth, setLeftWidth] = usePersistedNumber("pl.leftPanelWidth", 320);
  const [rightWidth, setRightWidth] = usePersistedNumber("pl.rightPanelWidth", 380);
  // Bumped from Settings to ask the chat view to open its memory panel; the chat owns that
  // panel, so the settings screen cannot render it directly.
  const [memoryOpenSignal, setMemoryOpenSignal] = useState(0);
  const [theme, setTheme] = useState<AppThemeId>(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isAppTheme(saved) ? saved : DEFAULT_THEME;
  });

  // Onboarding: the wizard configures the installation, the guide explains the screen. Both are
  // skippable and both can be relaunched from the help menu.
  const [qa] = useState(() => readOnboardingQa(window.location.search));
  const [wizardOpen, setWizardOpen] = useState(false);
  const [tourRunning, setTourRunning] = useState(false);
  const [tourStartStep, setTourStartStep] = useState(qa.step);
  const [tourMenuOpen, setTourMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftTab>("respuesta");
  // Each piece auto-runs at most once per session, so closing it never re-opens it in a loop.
  const autoRan = useRef({ wizard: false, tour: false });
  const panelsBeforeTour = useRef<{ left: boolean; right: boolean } | null>(null);

  // The title in index.html is only the pre-hydration default: the real one is interface copy, so
  // it is written here in the active language and rewritten when that language changes.
  const locale = useLocale();
  useEffect(() => {
    document.title = `${t("common.appName")} — ${t("common.tagline")}`;
  }, [locale, t]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "papel" ? "light" : "dark";
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const { chats, refresh, create, remove, rename } = useChatList();
  const chatState = useChat(activeChatId, refresh);
  const { active: activeProvider, refresh: refreshProviders } = useProviders();
  const { characters } = useCharacters();
  const userCharacters = getUserCharacters(characters);
  const { personas } = usePersonas();
  const { settings, refresh: refreshSettings } = useSettings();
  const { settings: comfySettings } = useComfyInjectSettings();

  // "Uso y costos" only makes sense on OpenRouter: it is the only provider that publishes
  // per-token pricing and reports a real cost. Any other active provider hides the feature.
  const usageEnabled = activeProvider?.id === "openrouter";
  const comfyInjectEnabled = !!comfySettings?.enabled;
  const providerNeedsKey = !!activeProvider && activeProvider.requiresApiKey && !activeProvider.hasKey;

  // The provider can be switched from inside the Presets modal, so re-read it when a modal closes
  // (that modal's own hook instance is the one that performed the change).
  const previousModal = useRef<ModalId>(null);
  useEffect(() => {
    if (previousModal.current !== null && modal === null) void refreshProviders();
    previousModal.current = modal;
  }, [modal, refreshProviders]);

  const focusPanels = useCallback((opts: { left?: boolean; right?: boolean }) => {
    if (opts.left !== undefined) setLeftCollapsed(!opts.left);
    if (opts.right !== undefined) setRightCollapsed(!opts.right);
  }, [setLeftCollapsed, setRightCollapsed]);

  const restorePanels = useCallback(() => {
    const previous = panelsBeforeTour.current;
    if (!previous) return;
    setLeftCollapsed(previous.left);
    setRightCollapsed(previous.right);
    panelsBeforeTour.current = null;
  }, [setLeftCollapsed, setRightCollapsed]);

  const startTour = useCallback((startStep = 0) => {
    panelsBeforeTour.current = { left: leftCollapsed, right: rightCollapsed };
    setTourStartStep(startStep);
    setTourRunning(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftCollapsed, rightCollapsed]);

  // Writes the version server-side (so the browser/profile doesn't matter) unless the URL forced
  // this run for QA, in which case nothing is recorded.
  const rememberWizard = useCallback(async () => {
    if (qa.wizard) return;
    await settingsApi.markOnboarding({ wizardVersion: WIZARD_VERSION });
    await refreshSettings();
  }, [qa.wizard, refreshSettings]);

  const rememberTour = useCallback(async () => {
    if (qa.tour) return;
    await settingsApi.markOnboarding({ tourVersion: TOUR_VERSION });
    await refreshSettings();
  }, [qa.tour, refreshSettings]);

  const handleWizardExit = useCallback(
    (opts: { startTour: boolean }) => {
      setWizardOpen(false);
      void rememberWizard();
      if (opts.startTour) startTour(0);
    },
    [rememberWizard, startTour],
  );

  const handleTourExit = useCallback(() => {
    setTourRunning(false);
    setTourStartStep(0);
    setTourMenuOpen(false);
    setViewMenuOpen(false);
    restorePanels();
    void rememberTour();
  }, [rememberTour, restorePanels]);

  const openGuide = useCallback(() => startTour(qa.step), [startTour, qa.step]);

  // Auto-start, in one effect on purpose: the wizard only where the installation cannot generate
  // anything yet, the guide only where there is nothing to explain yet (no chats). Starting the
  // guide has to wait for the wizard, and two separate effects would both fire on the same commit
  // (the wizard's state update is not visible to the second one yet).
  useEffect(() => {
    if (!settings || wizardOpen || tourRunning || modal !== null) return;
    if (!autoRan.current.wizard && !qa.tour && isWizardPending(settings, qa, providerNeedsKey)) {
      autoRan.current.wizard = true;
      setWizardOpen(true);
      return;
    }
    if (autoRan.current.tour) return;
    if (!isTourPending(settings, qa, { hasChats: chats.length > 0 })) return;
    autoRan.current.tour = true;
    startTour(qa.step);
  }, [settings, qa, providerNeedsKey, wizardOpen, tourRunning, modal, chats.length, startTour]);

  const tourCtx: TourContext = useMemo(
    () => ({
      hasCharacters: userCharacters.length > 0,
      hasChat: activeChatId !== null,
      comfyInjectEnabled,
      usageEnabled,
      focusPanels,
      restorePanels,
      setLeftTab,
      setTopMenuOpen: setTourMenuOpen,
      setViewMenuOpen,
      openModal: (id) => setModal(id),
      finish: () => {
        setTourRunning(false);
        setTourStartStep(0);
        setTourMenuOpen(false);
        setViewMenuOpen(false);
        restorePanels();
        void rememberTour();
      },
    }),
    [
      userCharacters.length,
      activeChatId,
      comfyInjectEnabled,
      usageEnabled,
      focusPanels,
      restorePanels,
      rememberTour,
    ],
  );

  const tourSteps = useMemo(() => buildTourSteps(tourCtx), [tourCtx]);

  function handleSelect(id: string) {
    setActiveChatId(id);
  }

  async function handleCreate(opts: { characterId?: string; personaId?: string }) {
    const id = await create(opts);
    setActiveChatId(id);
  }

  async function handleDelete(id: string) {
    await remove(id);
    if (id === activeChatId) setActiveChatId(null);
  }

  function closeCharacterEditor() {
    setEditingCharacterId(null);
    setCharactersVersion((v) => v + 1);
  }

  return (
    <div className="app-shell flex h-screen flex-col bg-bg text-text">
      <TopBar
        onOpen={(m) => setModal(m)}
        usageEnabled={usageEnabled}
        menuOpen={tourRunning ? tourMenuOpen : undefined}
        onMenuChange={setTourMenuOpen}
        onOpenGuide={openGuide}
        onOpenWizard={() => setWizardOpen(true)}
        onOpenPrompts={() => {
          setRightCollapsed(true);
          setLeftCollapsed(false);
        }}
        onOpenLibrary={() => {
          setLeftCollapsed(true);
          setRightCollapsed(false);
        }}
      />

      <div
        className="app-workspace flex min-h-0 flex-1"
        data-left-collapsed={String(leftCollapsed)}
        data-right-collapsed={String(rightCollapsed)}
      >
        {leftCollapsed ? (
          <CollapsedRail side="left" onExpand={() => setLeftCollapsed(false)} />
        ) : (
          <>
            <LeftSidebar
              width={leftWidth}
              onOpenSampling={() => setModal("presets")}
              onCollapse={() => setLeftCollapsed(true)}
              tab={tourRunning ? leftTab : undefined}
              onTabChange={setLeftTab}
            />
            <ResizeHandle onDrag={(dx) => setLeftWidth((w) => Math.min(640, Math.max(220, w + dx)))} />
          </>
        )}

        <main className="chat-stage flex min-w-0 flex-1 flex-col">
          <ChatView
            chatId={activeChatId}
            memoryOpenSignal={memoryOpenSignal}
            viewMenuOpen={tourRunning ? viewMenuOpen : undefined}
            onViewMenuChange={setViewMenuOpen}
            firstSteps={{
              hasKey: !!activeProvider && (!activeProvider.requiresApiKey || activeProvider.hasKey),
              hasPersona: personas.length > 0,
              hasCharacter: userCharacters.length > 0,
              hasChat: chats.length > 0,
              onOpenWizard: () => setWizardOpen(true),
              onOpenPersonas: () => setModal("personas"),
              onOpenLibrary: () => {
                setLeftCollapsed(true);
                setRightCollapsed(false);
              },
            }}
            {...chatState}
          />
        </main>

        {rightCollapsed ? (
          <CollapsedRail side="right" onExpand={() => setRightCollapsed(false)} />
        ) : (
          <>
            <ResizeHandle onDrag={(dx) => setRightWidth((w) => Math.min(640, Math.max(220, w - dx)))} />
            <RightPanel
              width={rightWidth}
              chats={chats}
              activeChatId={activeChatId}
              charactersVersion={charactersVersion}
              onSelect={handleSelect}
              onCreate={handleCreate}
              onRename={rename}
              onDelete={handleDelete}
              onEditCharacter={setEditingCharacterId}
              onOpenPersonas={() => setModal("personas")}
              onCollapse={() => setRightCollapsed(true)}
            />
          </>
        )}
      </div>

      {modal && modal !== "gateton-roleplay" && (
        <ConfigOverlay title={t(MODAL_TITLES[modal])} onClose={() => setModal(null)} wide={modal === "lorebooks"}>
          {modal === "presets" && <SamplingPresetManager />}
          {modal === "estudio" && <EstudioPanel />}
          {modal === "npc" && <NpcTrackerSettingsPanel />}
          {modal === "comfyinject" && <ComfyInjectSettings />}
          {modal === "usage" && usageEnabled && <UsageDashboard />}
          {modal === "recast" && (
            <div className="flex flex-col gap-8">
              <RecastSettings />
              <RecastPresetManager />
            </div>
          )}
          {modal === "importst" && <SillyTavernImportPanel />}
          {modal === "settings" && (
            <div className="flex flex-col gap-10">
              <LanguageSettings />
              <ThemeSettings value={theme} onChange={setTheme} />
              <GuideSettings onOpenGuide={openGuide} onOpenWizard={() => setWizardOpen(true)} />
              <MemoryOverview
                hasActiveChat={activeChatId !== null}
                onOpenPanel={() => {
                  setModal(null);
                  setMemoryOpenSignal((signal) => signal + 1);
                }}
              />
            </div>
          )}
          {modal === "personas" && <PersonaManager />}
          {modal === "character-creator" && <CharacterCreator onSaved={() => setCharactersVersion((v) => v + 1)} />}
          {modal === "director" && <DirectorModuleContent />}
          {modal === "lorebooks" && <LorebookStudio />}
        </ConfigOverlay>
      )}

      {modal === "gateton-roleplay" && (
        <GatetonRoleplay chat={chatState.chat} onClose={() => setModal(null)} />
      )}

      {editingCharacterId && (
        <Modal title={t("chrome.library.editCharacter")} onClose={closeCharacterEditor} size="lg">
          <CharacterEditor characterId={editingCharacterId} onClose={closeCharacterEditor} />
        </Modal>
      )}

      {wizardOpen && (
        <FirstRunWizard
          theme={theme}
          onThemeChange={setTheme}
          onOpenModal={(id) => {
            setWizardOpen(false);
            void rememberWizard();
            setModal(id);
          }}
          onFinish={handleWizardExit}
        />
      )}

      {tourRunning && (
        <OnboardingTour steps={tourSteps} ctx={tourCtx} startStep={tourStartStep} onExit={handleTourExit} />
      )}
    </div>
  );
}

export default App;
