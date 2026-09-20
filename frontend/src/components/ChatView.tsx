import { useEffect, useState } from "react";
import { Brain, MessagesSquare, Pencil, ScanSearch, Shirt } from "lucide-react";
import type { Chat } from "../types/chat";
import type { CharacterCard } from "../types/character";
import type { Persona } from "../types/persona";
import type { NpcRecord } from "../types/npcTracker";
import type { GuardFinding } from "../types/activeMemory";
import { usePersonas } from "../hooks/usePersonas";
import { useSettings } from "../hooks/useSettings";
import { buildBaseDict } from "../lib/macros";
import { MessageBubble } from "./MessageBubble";
import { Composer } from "./Composer";
import { RecastDiffModal } from "./RecastDiffModal";
import { Modal } from "./ui";
import { CharacterEditor } from "./characters/CharacterEditor";
import { ChatVariablesModal } from "./ChatVariablesModal";
import { ChatGalleryModal } from "./ChatGalleryModal";
import * as charactersApi from "../api/characters";
import { NpcRosterPanel } from "./npc/NpcRosterPanel";
import { VisualStatePanel } from "./director/VisualStatePanel";
import { ActiveMemoryPanel } from "./memory/ActiveMemoryPanel";
import { ChatOptionsMenu } from "./chat/ChatOptionsMenu";
import { FirstStepsCard, type FirstStepsState } from "./onboarding/FirstStepsCard";
import { useActiveMemory } from "../hooks/useActiveMemory";
import { useT } from "../i18n";
import * as lorebooksApi from "../api/lorebooks";
import type { Lorebook, LorebookScanResult } from "../types/lorebook";

interface Props {
  chatId: string | null;
  chat: Chat | null;
  character: CharacterCard | null;
  refreshCharacter: () => void;
  persona: Persona | null;
  isLoading: boolean;
  isStreaming: boolean;
  stopGeneration: () => void;
  streamError: string | null;
  imagesGenerating: Set<string>;
  recastProcessing: Set<string>;
  recastModalKey: string | null;
  runRecastOnMessage: (messageId: string, swipeIndex: number) => void;
  openRecastModal: (messageId: string, swipeIndex: number) => void;
  closeRecastModal: () => void;
  acceptRecast: (messageId: string, swipeIndex: number, newText?: string) => void;
  rejectRecast: (messageId: string, swipeIndex: number) => void;
  scanNpcs: (mode: "full" | "auto") => Promise<void>;
  updateNpcs: (npcs: NpcRecord[]) => void;
  evolveNpcsManually: () => Promise<number>;
  sendMessage: (text: string) => void;
  regenerate: () => void;
  continueLast: () => void;
  impersonate: (text: string) => void;
  editMessage: (id: string, text: string) => void;
  deleteMessage: (id: string) => void;
  swipeLeft: (id: string) => void;
  swipeRight: (id: string) => void;
  retryMarker: (messageId: string, markerKey: string, rawMarker: string) => void;
  generateMarker: (messageId: string, markerKey: string, rawMarker: string) => void;
  setChatPersona: (personaId: string | null) => void;
  setChatLorebook: (lorebookId: string | null) => void;
  setChatVariables: (variables: Record<string, string>) => void;
  runDirector: (messageId: string) => void;
  directorProcessing: Set<string>;
  cancelDirector: () => void;
  directorAvailable: boolean;
  directorErrors: Record<string, string>;
  directorDiagnostics: Record<string, import("../types/imageDirector").DirectorDiagnostic>;
  directorMinTagsPerImage: number;
  updateVisualState: (visualState: NonNullable<Chat["visualState"]>) => void;
  npcReactionProcessing: boolean;
  runVisualStateCheck: () => Promise<void>;
  visualStateCheckProcessing: boolean;
  visualStateCheckResult: string | null;
  /** Continuity Guard findings per message id, produced after each generated reply. */
  memoryGuardFindings: Record<string, import("../types/activeMemory").GuardReport>;
  /** Bumped by the chat hook whenever a background memory call changed the stored ledger. */
  memorySyncToken: number;
  /** Bumped by Settings to ask this view to open its memory panel. */
  memoryOpenSignal?: number;
  /** Controlled "Vista" menu, so the first-run guide can show it. Uncontrolled when omitted. */
  viewMenuOpen?: boolean;
  onViewMenuChange?: (open: boolean) => void;
  /** Progress checklist shown while no chat is open. Omitted = not rendered. */
  firstSteps?: FirstStepsState;
}

export function ChatView({
  chatId,
  chat,
  character,
  refreshCharacter,
  persona,
  isLoading,
  isStreaming,
  stopGeneration,
  streamError,
  imagesGenerating,
  recastProcessing,
  recastModalKey,
  runRecastOnMessage,
  openRecastModal,
  closeRecastModal,
  acceptRecast,
  rejectRecast,
  scanNpcs,
  updateNpcs,
  evolveNpcsManually,
  sendMessage,
  regenerate,
  continueLast,
  impersonate,
  editMessage,
  deleteMessage,
  swipeLeft,
  swipeRight,
  retryMarker,
  generateMarker,
  setChatPersona,
  setChatLorebook,
  setChatVariables,
  runDirector,
  directorProcessing,
  cancelDirector,
  directorAvailable,
  directorErrors,
  directorDiagnostics,
  directorMinTagsPerImage,
  updateVisualState,
  npcReactionProcessing,
  runVisualStateCheck,
  visualStateCheckProcessing,
  visualStateCheckResult,
  memoryGuardFindings,
  memorySyncToken,
  memoryOpenSignal = 0,
  viewMenuOpen,
  onViewMenuChange,
  firstSteps,
}: Props) {
  const t = useT();
  const [composerText, setComposerText] = useState("");
  const [editingCharacter, setEditingCharacter] = useState(false);
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [npcRosterOpen, setNpcRosterOpen] = useState(false);
  const [npcPreselectName, setNpcPreselectName] = useState<string | undefined>(undefined);
  const [npcFilterName, setNpcFilterName] = useState<string | null>(null);
  const [visualStateOpen, setVisualStateOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [npcScanning, setNpcScanning] = useState(false);
  const [npcEvolving, setNpcEvolving] = useState(false);
  const [lorebooks, setLorebooks] = useState<Lorebook[]>([]);
  const [loreInspectorOpen, setLoreInspectorOpen] = useState(false);
  const [loreTrace, setLoreTrace] = useState<LorebookScanResult | null>(null);
  const [loreScanning, setLoreScanning] = useState(false);
  const { personas } = usePersonas();
  const { settings, update } = useSettings();
  const activeMemory = useActiveMemory(chatId);

  // The panel is opened on demand, so it must re-read the ledger at that moment: extraction happens
  // in the background after each reply, and a stale snapshot would make the whole feature look
  // broken. The message count (not the messages array) is the refresh trigger so it fires once per
  // settled turn instead of once per streamed token.
  const memoryRefresh = activeMemory.refresh;
  const settledMessageCount = isStreaming ? null : (chat?.messages.length ?? null);
  useEffect(() => {
    if (memoryOpen) void memoryRefresh();
  }, [memoryOpen, memoryRefresh]);

  useEffect(() => {
    if (settledMessageCount !== null) void memoryRefresh();
  }, [settledMessageCount, memoryRefresh]);

  // Invalidation and extraction run in the background after an edit or a reply, so the ledger is
  // re-read whenever the chat hook reports that it changed.
  useEffect(() => {
    if (memorySyncToken > 0) void memoryRefresh();
  }, [memorySyncToken, memoryRefresh]);

  // Opening from Settings: the settings overlay has already closed by the time this lands, so
  // the panel is what the user sees next.
  useEffect(() => {
    if (memoryOpenSignal > 0) setMemoryOpen(true);
  }, [memoryOpenSignal]);

  async function handleNpcScan() {
    setNpcScanning(true);
    try {
      await scanNpcs("full");
    } finally {
      setNpcScanning(false);
    }
  }

  async function handleNpcEvolve() {
    setNpcEvolving(true);
    try {
      return await evolveNpcsManually();
    } finally {
      setNpcEvolving(false);
    }
  }

  // Click on an "@Name" mention rendered in the chat: plain click jumps to that NPC's roster
  // ficha, shift-click filters the chat to only messages mentioning them (same click/shift-click
  // duality Blocks already uses for CYOA buttons).
  function handleNpcMentionClick(name: string, shiftKey: boolean) {
    if (shiftKey) {
      setNpcFilterName((prev) => (prev === name ? null : name));
      return;
    }
    setNpcPreselectName(name);
    setNpcRosterOpen(true);
  }

  useEffect(() => { void lorebooksApi.listLorebooks().then(setLorebooks).catch(() => setLorebooks([])); }, [chatId]);

  useEffect(() => {
    if (settings) {
      document.documentElement.style.setProperty("--chat-font-size", `${settings.chatFontSize}px`);
      document.documentElement.style.setProperty("--chat-image-size", `${settings.chatImageSize}%`);
      document.documentElement.style.setProperty("--chat-density", settings.density === "compact" ? "0.5rem" : "1rem");
    }
  }, [settings]);

  function adjustFontSize(delta: number) {
    if (!settings) return;
    const next = Math.min(40, Math.max(10, settings.chatFontSize + delta));
    void update({ ...settings, chatFontSize: next });
  }

  function adjustImageSize(delta: number) {
    if (!settings) return;
    const next = Math.min(100, Math.max(20, settings.chatImageSize + delta));
    void update({ ...settings, chatImageSize: next });
  }

  async function openLoreInspector() {
    if (!chat) return;
    setLoreInspectorOpen(true);
    setLoreScanning(true);
    try { setLoreTrace(await lorebooksApi.scanLorebooks(chat, 8000)); }
    catch { setLoreTrace(null); }
    finally { setLoreScanning(false); }
  }

  function closeCharacterEditor() {
    setEditingCharacter(false);
    refreshCharacter();
  }

  if (!chatId) {
    return (
      <div className="chat-empty h-full" data-tour="chat-empty">
        <div className="chat-empty__card">
          <div className="chat-empty__mark"><img src="/logo.png" alt="" /></div>
          <span className="panel-kicker">{t("chat.empty.kicker")}</span>
          <h2 className="mt-2">{t("chat.empty.title")}</h2>
          <p>{t("chat.empty.body")}</p>
          {firstSteps && <FirstStepsCard state={firstSteps} />}
        </div>
      </div>
    );
  }

  if (isLoading || !chat) {
    return <p className="p-6 text-text-muted">{t("common.state.loading")}</p>;
  }

  const macroDict = buildBaseDict(character, persona);
  // The bubbles and the header paint the art at 40-48 px, so they get the cached thumbnail; the
  // lightbox gets the original file it can zoom into.
  const characterAvatarUrl = character ? charactersApi.thumbnailUrl(character.id, 128) : null;
  const characterAvatarFullUrl = character ? charactersApi.imageUrl(character.id) : null;

  const npcNames = chat.npcs?.map((n) => n.name) ?? [];
  const visibleMessages = npcFilterName
    ? chat.messages.filter((m) => (m.swipes[m.activeSwipeIndex] ?? "").toLowerCase().includes(`@${npcFilterName.toLowerCase()}`))
    : chat.messages;

  const [modalMessageId, modalSwipeIndex] = recastModalKey ? recastModalKey.split(":") : [null, null];
  const recastModalMessage = modalMessageId ? chat.messages.find((m) => m.id === modalMessageId) : null;
  const recastModalData = recastModalMessage?.recast ?? null;

  // Names available when deciding who may know a fact: the character, the NPC roster and the persona.
  const memoryKnownNames = [
    character?.name,
    persona?.name,
    ...(chat.npcs ?? []).map((npc) => npc.name),
  ].filter((name): name is string => Boolean(name?.trim()));

  const memorySummary = activeMemory.memory
    ? {
        facts: activeMemory.memory.facts.length,
        threads: activeMemory.memory.threads.length,
        needsReview:
          activeMemory.memory.facts.filter((fact) => fact.needsReview).length +
          activeMemory.memory.threads.filter((thread) => thread.needsReview).length,
      }
    : null;

  /**
   * Guard findings for one message. The live state wins because it is fresher, but the stored
   * `lastGuard` is the fallback so a warning survives a page reload instead of vanishing with the
   * in-memory result of the turn that produced it.
   */
  function guardFindingsFor(messageId: string): GuardFinding[] | null {
    const live = memoryGuardFindings[messageId]?.findings;
    if (live?.length) return live;
    const stored = activeMemory.memory?.lastGuard;
    if (stored?.messageId === messageId && stored.findings.length > 0) return stored.findings;
    return null;
  }

  /** Jumps to the message a memory item cites, so evidence is always one click away. */
  function goToMessage(messageId: string) {
    setMemoryOpen(false);
    window.setTimeout(() => {
      const target = document.querySelector(`[data-message-id="${messageId}"]`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("memory-source-flash");
      window.setTimeout(() => target.classList.remove("memory-source-flash"), 1600);
    }, 60);
  }

  function handleQuote(text: string) {
    setComposerText((prev) => (prev ? `${prev}\n\n${text}` : text));
  }

  return (
    <div className="flex h-full flex-col">
      {!character && (
        <div className="chat-header flex items-center gap-3" data-tour="chat-header">
          <div className="chat-header__identity">
            <strong className="chat-header__name font-display font-semibold text-text" data-user-data>
              {chat.title}
            </strong>
            <span className="chat-header__status">{t("chat.header.noCharacter")}</span>
          </div>
          <div className="chat-header__tools ml-auto" data-tour="chat-tools">
            <button
              data-tour="chat-memory"
              onClick={() => setMemoryOpen(true)}
              title={t("chat.header.memoryHintExperimental")}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-text"
            >
              <Brain size={14} />
              <span>{t("chat.header.memory")}</span>
              <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning" title={t("chat.header.experimentalHint")}>{t("chat.header.experimentalBadge")}</span>
              {memorySummary && memorySummary.facts + memorySummary.threads > 0 && (
                <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                  {memorySummary.facts + memorySummary.threads}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {character && (
        <div className="chat-header flex items-center gap-3" data-tour="chat-header">
          <img
            src={characterAvatarUrl ?? undefined}
            alt={character.name}
            className="chat-header__avatar object-cover"
          />
          <div className="chat-header__identity">
            <strong className="chat-header__name font-display font-semibold text-text" data-user-data>
              {character.name}
            </strong>
            <span className="chat-header__status">{t("chat.header.activeScene")}</span>
          </div>
          <button
            onClick={() => setEditingCharacter(true)}
            aria-label={t("chat.header.editCharacter")}
            title={t("chat.header.editCharacter")}
            className="cursor-pointer rounded p-1.5 text-text-faint transition-colors hover:bg-bg-elevated-2 hover:text-text"
          >
            <Pencil size={14} />
          </button>
          <div className="chat-header__tools ml-auto" data-tour="chat-tools">
            <ChatOptionsMenu
              fontSize={settings?.chatFontSize ?? 18}
              imageSize={settings?.chatImageSize ?? 100}
              density={settings?.density ?? "comfortable"}
              personas={personas}
              personaId={chat.personaId ?? null}
              lorebooks={lorebooks}
              lorebookId={typeof chat.extensionData?.lorebookId === "string" ? chat.extensionData.lorebookId : null}
              onFontSize={adjustFontSize}
              onImageSize={adjustImageSize}
              onDensity={(density) => { if (settings) void update({ ...settings, density }); }}
              onPersona={setChatPersona}
              onLorebook={setChatLorebook}
              onOpenLoreInspector={() => void openLoreInspector()}
              onOpenGallery={() => setGalleryOpen(true)}
              onOpenVariables={() => setVariablesOpen(true)}
              menuOpen={viewMenuOpen}
              onMenuChange={onViewMenuChange}
            />
            <button
              onClick={() => setNpcRosterOpen(true)}
              title={t("chat.header.npcRosterHint")}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-text"
            >
              <ScanSearch size={14} />
              <span>{t("chat.header.npcs")}</span>
              {(chat.npcs?.length ?? 0) > 0 && (
                <span className="rounded-full bg-accent-2/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent-2">{chat.npcs?.length}</span>
              )}
            </button>
            <button
              onClick={() => setVisualStateOpen(true)}
              title={t("chat.header.visualStateHint")}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-text"
            >
              <Shirt size={14} />
              <span>{t("chat.header.visualState")}</span>
              {Object.keys(chat.visualState ?? {}).length > 0 && (
                <span className="rounded-full bg-accent-2/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent-2">
                  {Object.keys(chat.visualState ?? {}).length}
                </span>
              )}
            </button>
            <button
              data-tour="chat-memory"
              onClick={() => setMemoryOpen(true)}
              title={t("chat.header.memoryHint")}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-text"
            >
              <Brain size={14} />
              <span>{t("chat.header.memory")}</span>
              {((activeMemory.memory?.facts.length ?? 0) + (activeMemory.memory?.threads.length ?? 0)) > 0 && (
                <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                  {(activeMemory.memory?.facts.length ?? 0) + (activeMemory.memory?.threads.length ?? 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="chat-scroll flex-1 overflow-y-auto px-6 py-4" data-tour="chat-thread">
        <div className="chat-thread">
        {chat.messages.length === 0 && (
          <div className="chat-empty min-h-[50vh]">
            <div className="chat-empty__card">
              <MessagesSquare size={28} className="mx-auto text-accent" />
              <h2 className="mt-4">{t("chat.thread.emptyTitle")}</h2>
              <p>{t("chat.thread.emptyBody")}</p>
            </div>
          </div>
        )}

        {npcFilterName && (
          <div className="mb-3 flex items-center justify-between rounded-md border border-accent-2/40 bg-accent-2/10 px-3 py-2 text-xs text-text">
            <span>
              {t("chat.thread.filterPrefix")}<span className="font-medium text-accent-2">@{npcFilterName}</span>{t("chat.thread.filterSuffix", { count: visibleMessages.length })}
            </span>
            <button onClick={() => setNpcFilterName(null)} className="cursor-pointer font-medium text-accent-2 hover:underline">
              {t("chat.thread.clearFilter")}
            </button>
          </div>
        )}

        {visibleMessages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLast={message.id === chat.messages[chat.messages.length - 1]?.id}
            disabled={isStreaming}
            macroDict={macroDict}
            characterAvatarUrl={message.role === "assistant" ? characterAvatarUrl : null}
            characterAvatarFullUrl={message.role === "assistant" ? characterAvatarFullUrl : null}
            characterName={character?.name ?? null}
            personaAvatarUrl={message.role === "user" ? (message.personaAvatar ?? persona?.avatar ?? null) : null}
            memory={memorySummary}
            guardFindings={guardFindingsFor(message.id)}
            onOpenMemory={() => setMemoryOpen(true)}
            isGeneratingImages={imagesGenerating.has(`${message.id}:${message.activeSwipeIndex}`)}
            generatingMarkerKeys={imagesGenerating}
            isRecastProcessing={recastProcessing.has(`${message.id}:${message.activeSwipeIndex}`)}
            onEdit={editMessage}
            onDelete={deleteMessage}
            onSwipeLeft={swipeLeft}
            onSwipeRight={swipeRight}
            onRegenerate={regenerate}
            onRetryMarker={retryMarker}
            onGenerateMarker={generateMarker}
            onQuote={handleQuote}
            onContinue={continueLast}
            onRunRecast={(id, swipeIndex) => runRecastOnMessage(id, swipeIndex)}
            onOpenRecast={(id, swipeIndex) => openRecastModal(id, swipeIndex)}
            isDirectorProcessing={directorProcessing.has(message.id)}
            onRunDirector={runDirector}
            directorAvailable={directorAvailable}
            directorErrors={directorErrors}
            directorDiagnostics={directorDiagnostics}
            directorMinTagsPerImage={directorMinTagsPerImage}
            npcNames={npcNames}
            onNpcMentionClick={handleNpcMentionClick}
          />
        ))}

        {streamError && (
          <p className="mt-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {t("chat.thread.errorLabel", { message: streamError })}
          </p>
        )}
        </div>
      </div>

      <Composer
        disabled={isStreaming || npcReactionProcessing}
        isStreaming={isStreaming}
        npcReactionProcessing={npcReactionProcessing}
        directorProcessing={directorProcessing.size > 0}
        onCancelDirector={cancelDirector}
        value={composerText}
        characterName={character?.name}
        characterId={chat.characterId}
        npcs={chat.npcs ?? []}
        onChange={setComposerText}
        onSend={sendMessage}
        onImpersonate={impersonate}
        onStop={stopGeneration}
      />

      {loreInspectorOpen && (
        <Modal title={t("chat.loreInspector.title")} onClose={() => setLoreInspectorOpen(false)} size="lg">
          {loreScanning ? <p className="py-10 text-center text-text-muted">{t("chat.loreInspector.scanning")}</p> : loreTrace ? <div className="lore-trace"><div className="lore-trace__budget"><div><strong>{loreTrace.usedTokens}</strong><span>{t("chat.loreInspector.usedTokens")}</span></div><div><strong>{loreTrace.budgetTokens}</strong><span>{t("chat.loreInspector.budget")}</span></div><div><strong>{loreTrace.trace.filter((item) => item.status === "activated").length}</strong><span>{t("chat.loreInspector.activated")}</span></div></div>{loreTrace.overflowed && <p className="lore-trace__warning">{t("chat.loreInspector.overflow")}</p>}<div className="lore-trace__list">{loreTrace.trace.map((item, index) => <div key={`${item.lorebookId}:${item.uid}:${index}`} className={`lore-trace-row is-${item.status}`}><span className="lore-trace-row__dot" /><div><strong>{item.comment || t("chat.loreInspector.entry", { uid: item.uid })}</strong><small>{item.lorebookName} · {item.source}</small><p>{item.reason}</p></div><em>~{item.tokenEstimate}</em></div>)}{!loreTrace.trace.length && <p className="py-8 text-center text-text-muted">{t("chat.loreInspector.noLorebooks")}</p>}</div></div> : <p className="py-10 text-center text-danger">{t("chat.loreInspector.failed")}</p>}
        </Modal>
      )}

      {editingCharacter && character && (
        <Modal title={t("chat.header.editCharacterNamed", { name: character.name })} onClose={closeCharacterEditor} size="lg">
          <CharacterEditor embedded characterId={character.id} onClose={closeCharacterEditor} />
        </Modal>
      )}

      {recastModalMessage && recastModalData && modalSwipeIndex !== null && (
        <RecastDiffModal
          data={recastModalData}
          onAccept={(text) => {
            acceptRecast(recastModalMessage.id, Number(modalSwipeIndex), text);
            closeRecastModal();
          }}
          onReject={() => {
            rejectRecast(recastModalMessage.id, Number(modalSwipeIndex));
            closeRecastModal();
          }}
          onClose={closeRecastModal}
        />
      )}

      {variablesOpen && (
        <ChatVariablesModal variables={chat.variables ?? {}} onSave={setChatVariables} onClose={() => setVariablesOpen(false)} />
      )}

      {galleryOpen && <ChatGalleryModal chat={chat} onClose={() => setGalleryOpen(false)} />}

      {npcRosterOpen && (
        <Modal
          title={t("chat.npcRoster.title")}
          onClose={() => {
            setNpcRosterOpen(false);
            setNpcPreselectName(undefined);
          }}
          size="lg"
        >
          <NpcRosterPanel
            chat={chat}
            onScan={handleNpcScan}
            scanning={npcScanning}
            onEvolve={handleNpcEvolve}
            evolving={npcEvolving}
            onUpdateNpcs={updateNpcs}
            preselectName={npcPreselectName}
          />
        </Modal>
      )}

      {visualStateOpen && (
        <Modal title={t("chat.visualState.title")} onClose={() => setVisualStateOpen(false)} size="lg">
          <VisualStatePanel
            chat={chat}
            onUpdate={updateVisualState}
            onRunCheck={runVisualStateCheck}
            checkProcessing={visualStateCheckProcessing}
            checkResult={visualStateCheckResult}
          />
        </Modal>
      )}

      {memoryOpen && (
        <Modal title={t("chat.memory.title")} onClose={() => setMemoryOpen(false)} size="lg">
          <ActiveMemoryPanel
            memory={activeMemory.memory}
            loading={activeMemory.loading}
            error={activeMemory.error}
            savingIds={activeMemory.savingIds}
            onRetry={() => void activeMemory.refresh()}
            onUpdateFact={activeMemory.updateFact}
            onUpdateThread={activeMemory.updateThread}
            onToggleEnabled={(enabled) => activeMemory.updateSettings({ enabled })}
            onUpdateSettings={activeMemory.updateSettings}
            onUpdateItem={activeMemory.updateItem}
            onMerge={activeMemory.merge}
            onRollback={activeMemory.rollback}
            onRunExtraction={activeMemory.runExtraction}
            onPreviewBrief={activeMemory.previewBrief}
            lastExtractionReport={activeMemory.lastExtractionReport}
            knownNames={memoryKnownNames}
            onGoToMessage={goToMessage}
          />
        </Modal>
      )}
    </div>
  );
}
