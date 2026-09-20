import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Brain, ChevronLeft, ChevronRight, Copy, Film, ImagePlus, Pencil, RefreshCw, RotateCcw, Sparkles, TriangleAlert, Trash2 } from "lucide-react";
import type { ChatMessage, TurnEventDetail } from "../types/chat";
import type { DirectorDiagnostic } from "../types/imageDirector";
import type { GuardFinding } from "../types/activeMemory";
import { TurnEventDetailModal } from "./TurnEventDetailModal";
import { substituteMacros, type MacroDict } from "../lib/macros";
import { splitTextWithMarkers } from "../lib/imageMarkers";
import { renderRichText } from "../lib/richText";
import { useT } from "../i18n";
import { Button, Modal, textareaClasses } from "./ui";

interface Props {
  message: ChatMessage;
  isLast: boolean;
  disabled: boolean;
  macroDict: MacroDict;
  characterAvatarUrl: string | null;
  /** Optional original-size art for the click-to-enlarge view; falls back to `characterAvatarUrl`. */
  characterAvatarFullUrl?: string | null;
  characterName: string | null;
  personaAvatarUrl: string | null;
  isGeneratingImages: boolean;
  generatingMarkerKeys: Set<string>;
  isRecastProcessing: boolean;
  isDirectorProcessing: boolean;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onSwipeLeft: (id: string) => void;
  onSwipeRight: (id: string) => void;
  onRegenerate: () => void;
  onRetryMarker: (messageId: string, markerKey: string, rawMarker: string) => void;
  onQuote: (text: string) => void;
  onContinue: () => void;
  onGenerateMarker: (messageId: string, markerKey: string, rawMarker: string) => void;
  onRunRecast: (messageId: string, swipeIndex: number) => void;
  onOpenRecast: (messageId: string, swipeIndex: number) => void;
  onRunDirector: (messageId: string) => void;
  directorAvailable: boolean;
  directorErrors: Record<string, string>;
  directorDiagnostics: Record<string, DirectorDiagnostic>;
  directorMinTagsPerImage: number;
  npcNames: string[];
  onNpcMentionClick: (name: string, shiftKey: boolean) => void;
  /** Memoria Viva badge data for this message. Omitted/null = no badge at all. */
  memory?: { facts: number; threads: number; needsReview: number } | null;
  /** Continuity Guard findings for this message. Empty/null = no notice. */
  guardFindings?: GuardFinding[] | null;
  /** Opens the Memoria Viva panel. Without it the badge renders as a plain, inert chip. */
  onOpenMemory?: () => void;
  /** Optional: lets the notice offer a "Descartar" action that hides the findings. */
  onDismissGuard?: (messageId: string) => void;
}

function MessageContent({
  message,
  displayContent,
  isGeneratingImages,
  generatingMarkerKeys,
  onRetryMarker,
  onGenerateMarker,
  directorMinTagsPerImage,
  npcNames,
  onNpcMentionClick,
}: {
  message: ChatMessage;
  displayContent: string;
  isGeneratingImages: boolean;
  generatingMarkerKeys: Set<string>;
  onRetryMarker: (messageId: string, markerKey: string, rawMarker: string) => void;
  onGenerateMarker: (messageId: string, markerKey: string, rawMarker: string) => void;
  directorMinTagsPerImage: number;
  npcNames: string[];
  onNpcMentionClick: (name: string, shiftKey: boolean) => void;
}) {
  const t = useT();
  const segments = splitTextWithMarkers(displayContent);
  const [lightbox, setLightbox] = useState<{
    url: string;
    prompt: string;
    seed: number;
    ar: string;
    shot: string;
    checkpoint: string;
    loras: { name: string; strength_model: number; strength_clip: number }[];
  } | null>(null);

  function handleContentClick(e: ReactMouseEvent<HTMLDivElement>) {
    const target = (e.target as HTMLElement).closest<HTMLElement>(".npc-mention");
    if (!target) return;
    const name = target.dataset.npcName;
    if (name) onNpcMentionClick(name, e.shiftKey);
  }

  return (
    <>
      <div
        onClick={handleContentClick}
        style={{ fontSize: "var(--chat-font-size, 16px)" }}
        className="message-content leading-relaxed text-text
          [&_p]:mb-3 [&_p:last-child]:mb-0
          [&_details]:my-2 [&_details]:rounded-md [&_details]:border [&_details]:border-border [&_details]:bg-bg-elevated-2 [&_details]:p-2
          [&_summary]:cursor-pointer [&_summary]:font-medium [&_summary]:text-text-muted
          [&_code]:rounded [&_code]:bg-bg-elevated-2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs
          [&_a]:text-accent [&_a]:underline
          [&_em]:text-text-muted
          [&_.npc-mention]:cursor-pointer [&_.npc-mention]:rounded [&_.npc-mention]:bg-accent-2/15 [&_.npc-mention]:px-0.5 [&_.npc-mention]:text-accent-2 [&_.npc-mention]:hover:bg-accent-2/25"
      >
        {segments.map((segment, i) => {
          if (segment.type === "text") {
            return <div key={i} dangerouslySetInnerHTML={{ __html: renderRichText(segment.content, npcNames) }} />;
          }

          const key = `${message.activeSwipeIndex}:${segment.index}`;
          const result = message.images?.[key];
          // Only THIS marker's own regenerate button should disable while it's in flight —
          // ComfyUI queues jobs fine, so other images in the same message stay clickable.
          const isThisMarkerGenerating = generatingMarkerKeys.has(`${message.id}:${key}`);

          if (!result) {
            if (isGeneratingImages) {
              return (
                <em key={i} className="text-text-faint">
                  {t("chat.image.generating")}
                </em>
              );
            }
            return (
              <span key={i} className="my-1 block">
                <Button variant="secondary" size="sm" onClick={() => onGenerateMarker(message.id, key, segment.raw)}>
                  <ImagePlus size={14} />
                  {t("chat.image.generate")}
                </Button>
              </span>
            );
          }

          if (result.status === "ok") {
            return (
              <span key={i} className="my-2 flex flex-col items-center gap-1.5">
                <img
                  src={result.url}
                  alt={result.prompt}
                  loading="lazy"
                  decoding="async"
                  onClick={() =>
                    setLightbox({
                      url: result.url,
                      prompt: result.prompt,
                      seed: result.seed,
                      ar: result.ar,
                      shot: result.shot,
                      checkpoint: result.checkpoint ?? "",
                      loras: result.loras ?? [],
                    })
                  }
                  title={t("chat.image.viewLarge")}
                  className="w-auto cursor-pointer rounded-md border border-border transition-opacity hover:opacity-90"
                  style={{ maxWidth: "var(--chat-image-size, 100%)" }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-0"
                  onClick={() => onRetryMarker(message.id, key, result.rawMarker)}
                  disabled={isThisMarkerGenerating}
                >
                  <RefreshCw size={14} />
                  {isThisMarkerGenerating ? t("chat.image.regenerating") : t("chat.image.regenerate")}
                </Button>
              </span>
            );
          }

          if (result.status === "parse_error") {
            return (
              <span key={i} className="my-1 flex items-center gap-1.5 text-sm text-warning">
                <TriangleAlert size={14} />
                {t("chat.image.invalidMarker", { reason: result.reason })}
              </span>
            );
          }

          return (
            <span key={i} className="my-1 flex flex-wrap items-center gap-2 text-sm text-danger">
              <TriangleAlert size={14} />
              {t("chat.image.failed", { reason: result.reason })}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRetryMarker(message.id, key, result.rawMarker)}
                disabled={isThisMarkerGenerating}
              >
                <RefreshCw size={14} />
                {isThisMarkerGenerating ? t("chat.image.retrying") : t("chat.image.retry")}
              </Button>
            </span>
          );
        })}
      </div>
      {lightbox && (
        <Modal title={t("chat.image.lightboxTitle")} onClose={() => setLightbox(null)} size="lg">
          <img
            src={lightbox.url}
            alt={lightbox.prompt}
            className="mx-auto max-h-[60vh] w-full rounded-md border border-border object-contain"
          />
          <div className="mt-3 rounded-md border border-border bg-bg-elevated-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-text-muted">{t("chat.image.tags")}</p>
              {(() => {
                const tagCount = lightbox.prompt.split(",").map((t) => t.trim()).filter(Boolean).length;
                const short = directorMinTagsPerImage > 0 && tagCount < directorMinTagsPerImage;
                return (
                  <span className={`text-xs ${short ? "font-medium text-danger" : "text-text-faint"}`}>
                    {short && "⚠ "}
                    {t("chat.image.tagCount", { count: tagCount })}
                    {directorMinTagsPerImage > 0 && ` ${t("chat.image.minTags", { count: directorMinTagsPerImage })}`}
                  </span>
                );
              })()}
            </div>
            <p className="mt-1 break-words text-sm leading-relaxed text-text">{lightbox.prompt}</p>
            <p className="mt-2 text-xs text-text-faint">
              {t("chat.image.seedLine", { seed: lightbox.seed, ar: lightbox.ar, shot: lightbox.shot })}
            </p>
            <p className="mt-1 break-words text-xs text-text-faint">
              {t("chat.image.model")} {lightbox.checkpoint || "—"}
              <br />
              {t("chat.image.loras")}{" "}
              {lightbox.loras.length > 0
                ? lightbox.loras.map((l) => `${l.name} (${l.strength_model}/${l.strength_clip})`).join(", ")
                : "—"}
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}

export function MessageBubble({
  message,
  isLast,
  disabled,
  macroDict,
  characterAvatarUrl,
  characterAvatarFullUrl,
  characterName,
  personaAvatarUrl,
  isGeneratingImages,
  generatingMarkerKeys,
  isRecastProcessing,
  isDirectorProcessing,
  onEdit,
  onDelete,
  onSwipeLeft,
  onSwipeRight,
  onRegenerate,
  onRetryMarker,
  onQuote,
  onContinue,
  onGenerateMarker,
  onRunRecast,
  onOpenRecast,
  onRunDirector,
  directorAvailable,
  directorErrors,
  directorDiagnostics,
  directorMinTagsPerImage,
  npcNames,
  onNpcMentionClick,
  memory,
  guardFindings,
  onOpenMemory,
  onDismissGuard,
}: Props) {
  const t = useT();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [avatarLightbox, setAvatarLightbox] = useState<{ url: string; name: string } | null>(null);
  const [eventDetail, setEventDetail] = useState<TurnEventDetail | null>(null);
  const [directorDiagnosticOpen, setDirectorDiagnosticOpen] = useState(false);
  const [guardFindingsOpen, setGuardFindingsOpen] = useState(false);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement>(null);

  // Stored raw (macros unresolved); resolved only for display, never persisted.
  const content = message.swipes[message.activeSwipeIndex];
  const displayContent = substituteMacros(content, macroDict);
  const hasMultipleSwipes = message.swipes.length > 1;
  const canRegenerate = isLast && message.role === "assistant";
  const controlsDisabled = disabled || isGeneratingImages || isRecastProcessing || isDirectorProcessing;
  const isUser = message.role === "user";
  const speakerName = isUser
    ? macroDict.user !== "User"
      ? macroDict.user
      : t("chat.speaker.user")
    : macroDict.char !== "Assistant"
      ? macroDict.char
      : t("chat.speaker.assistant");
  // Both extras are pure render decorations: with no props the bubble behaves exactly as before.
  const hasMemoryBadge = !!memory && (memory.facts > 0 || memory.threads > 0 || memory.needsReview > 0);
  const hasGuardFindings = !!guardFindings && guardFindings.length > 0;
  // Spelled out for screen readers; the review count only joins in when there is something to review.
  const memoryBadgeLabel = memory
    ? `${t("chat.memory.badgeLabel", { facts: memory.facts, threads: memory.threads })}${
        memory.needsReview > 0 ? t("chat.memory.badgeLabelReview", { count: memory.needsReview }) : ""
      }`
    : "";

  function startEditing() {
    setDraft(content);
    setIsEditing(true);
  }

  function confirmEdit() {
    onEdit(message.id, draft);
    setIsEditing(false);
  }

  function copyToClipboard(text: string) {
    void navigator.clipboard.writeText(text);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (copyMenuRef.current && !copyMenuRef.current.contains(e.target as Node)) {
        setCopyMenuOpen(false);
      }
    }
    if (copyMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [copyMenuOpen]);

  return (
    <div
      data-message-id={message.id}
      style={{ marginBottom: "var(--chat-density, 1rem)" }}
      className={`message-row message-row--${isUser ? "user" : "assistant"} group flex w-full items-start gap-3${isDirectorProcessing ? " director-pulse" : ""}`}
    >
      <div className="shrink-0">
        {!isUser && characterAvatarUrl && (
          <img
            src={characterAvatarUrl}
            alt={characterName ?? t("chat.speaker.characterFallback")}
            loading="lazy"
            decoding="async"
            onClick={() =>
              setAvatarLightbox({
                url: characterAvatarFullUrl ?? characterAvatarUrl,
                name: characterName ?? t("chat.speaker.characterFallbackCapitalized"),
              })
            }
            title={t("chat.image.viewLargeAvatar")}
            className="message-avatar h-10 w-10 cursor-pointer rounded-full border border-border object-cover transition-opacity hover:opacity-85"
          />
        )}
        {isUser && personaAvatarUrl && (
          <img
            src={personaAvatarUrl}
            alt={macroDict.user || t("chat.speaker.user")}
            onClick={() => setAvatarLightbox({ url: personaAvatarUrl, name: macroDict.user || t("chat.speaker.user") })}
            title={t("chat.image.viewLargeAvatar")}
            className="message-avatar h-10 w-10 cursor-pointer rounded-full border border-border object-cover transition-opacity hover:opacity-85"
          />
        )}
        {isUser && !personaAvatarUrl && (
          <span className="message-avatar flex h-10 w-10 items-center justify-center rounded-full border border-border bg-bg-elevated-2 text-xs font-semibold text-text-muted">
            {(macroDict.user || t("chat.speaker.user")).charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="message-body min-w-0 flex-1">
        <strong className={`message-speaker ${isUser ? "text-accent" : "text-accent-2"}`}>{speakerName}</strong>

        {hasMemoryBadge && memory && (
          <button
            type="button"
            onClick={() => onOpenMemory?.()}
            disabled={!onOpenMemory}
            aria-label={memoryBadgeLabel}
            title={onOpenMemory ? t("chat.memory.openBadge") : t("chat.memory.badgeTitle")}
            className="ml-2 inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-bg-elevated-2 px-1.5 py-0.5 align-middle text-[11px] font-normal text-text-muted transition-colors hover:border-accent-2 hover:text-text disabled:cursor-default disabled:hover:border-border disabled:hover:text-text-muted"
          >
            <Brain size={12} className="shrink-0 text-accent-2" />
            <span className="tabular-nums">{memory.facts}</span>
            <span className="text-text-faint">{t("chat.memory.facts")}</span>
            <span className="text-text-faint">·</span>
            <span className="tabular-nums">{memory.threads}</span>
            <span className="text-text-faint">{t("chat.memory.threads")}</span>
            {memory.needsReview > 0 && (
              <span className="font-medium tabular-nums text-warning">· {memory.needsReview} {t("chat.memory.needsReview")}</span>
            )}
          </button>
        )}

      {message.reasonings?.[message.activeSwipeIndex]?.trim() && (
        <details className="mt-2 rounded-md border border-border bg-bg-elevated-2/50 px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-text-muted transition-colors hover:text-text">
            {t("chat.reasoning.title")}
          </summary>
          <div className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-text-muted">{message.reasonings[message.activeSwipeIndex]}</div>
        </details>
      )}

      {hasGuardFindings && guardFindings && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="leading-relaxed">
              {t("chat.guard.conflict", { reason: guardFindings[0].reason })}
              {guardFindings.length > 1 && t("chat.guard.moreFindings", { count: guardFindings.length - 1 })}
            </p>
            <div className="mt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setGuardFindingsOpen(true)}
                className="cursor-pointer font-medium underline underline-offset-2 transition-colors hover:text-text"
              >
                {t("chat.guard.viewDetails")}
              </button>
              {onDismissGuard && (
                <button
                  type="button"
                  onClick={() => onDismissGuard(message.id)}
                  className="cursor-pointer font-medium underline underline-offset-2 transition-colors hover:text-text"
                >
                  {t("chat.guard.dismiss")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isEditing ? (
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className={`${textareaClasses} mt-1`}
          />
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={confirmEdit}>
              {t("common.actions.save")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
              {t("common.actions.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-1.5">
          {isRecastProcessing && <p className="mb-1.5 text-sm italic text-text-faint">{t("chat.message.polishing")}</p>}
          {isDirectorProcessing && (
            <div className="mb-1.5 flex items-center gap-1.5 text-sm italic text-accent-2">
              <Film size={14} className="animate-pulse" />
              <span>{t("chat.message.insertingTags")}</span>
            </div>
          )}
          {directorErrors[message.id] && (
            <button
              type="button"
              onClick={() => directorDiagnostics[message.id] && setDirectorDiagnosticOpen(true)}
              disabled={!directorDiagnostics[message.id]}
              title={directorDiagnostics[message.id] ? t("chat.director.viewResponse") : undefined}
              className="mb-1.5 flex w-full items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-left text-xs text-warning transition-colors hover:bg-warning/15 disabled:cursor-default disabled:hover:bg-warning/10"
            >
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              <span>{directorErrors[message.id]}</span>
            </button>
          )}
          <MessageContent
            message={message}
            displayContent={displayContent}
            isGeneratingImages={isGeneratingImages}
            generatingMarkerKeys={generatingMarkerKeys}
            onRetryMarker={onRetryMarker}
            onGenerateMarker={onGenerateMarker}
            directorMinTagsPerImage={directorMinTagsPerImage}
            npcNames={npcNames}
            onNpcMentionClick={onNpcMentionClick}
          />
        </div>
      )}

      {message.events && message.events.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {message.events.map((raw, i) => {
            const event = typeof raw === "string" ? { text: raw } : raw;
            const clickable = !!event.detail;
            return clickable ? (
              <button
                key={i}
                onClick={() => setEventDetail(event.detail!)}
                title={t("chat.turnEvent.viewChanges")}
                className="turn-event cursor-pointer rounded-full border border-border bg-bg-elevated-2 px-2 py-0.5 text-[11px] text-text-muted transition-colors hover:border-accent-2 hover:text-text"
              >
                {event.text}
              </button>
            ) : (
              <span key={i} className="turn-event rounded-full border border-border bg-bg-elevated-2 px-2 py-0.5 text-[11px] text-text-muted">
                {event.text}
              </span>
            );
          })}
        </div>
      )}

      <div className="message-actions mt-1.5 flex flex-wrap items-center gap-1 text-xs opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {hasMultipleSwipes && message.role === "assistant" && (
          <div className="mr-2 flex items-center gap-1 text-text-muted">
            <button
              onClick={() => onSwipeLeft(message.id)}
              disabled={controlsDisabled || message.activeSwipeIndex === 0}
              aria-label={t("chat.message.previousVersion")}
              className="cursor-pointer rounded p-1 transition-colors hover:bg-bg-elevated-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="tabular-nums">
              {message.activeSwipeIndex + 1}/{message.swipes.length}
            </span>
            <button
              onClick={() => onSwipeRight(message.id)}
              disabled={controlsDisabled || message.activeSwipeIndex === message.swipes.length - 1}
              aria-label={t("chat.message.nextVersion")}
              className="cursor-pointer rounded p-1 transition-colors hover:bg-bg-elevated-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
        {!isEditing && (
          <Button variant="ghost" size="sm" onClick={startEditing} disabled={controlsDisabled}>
            <Pencil size={13} />
            {t("chat.message.edit")}
          </Button>
        )}
        <div className="relative" ref={copyMenuRef}>
          <Button variant="ghost" size="sm" onClick={() => setCopyMenuOpen((o) => !o)} disabled={controlsDisabled}>
            <Copy size={13} />
            {t("chat.message.copy")}
          </Button>
          {copyMenuOpen && (
            <div className="absolute bottom-full left-0 z-20 mb-1 w-44 overflow-hidden rounded-md border border-border bg-bg-elevated shadow-xl">
              <button
                className="flex w-full cursor-pointer items-center px-3 py-2 text-left text-xs text-text transition-colors hover:bg-bg-elevated-2"
                onClick={() => {
                  copyToClipboard(displayContent);
                  setCopyMenuOpen(false);
                }}
              >
                {t("chat.message.copyText")}
              </button>
              <button
                className="flex w-full cursor-pointer items-center px-3 py-2 text-left text-xs text-text transition-colors hover:bg-bg-elevated-2"
                title={t("chat.message.copyRawHint")}
                onClick={() => {
                  copyToClipboard(content);
                  setCopyMenuOpen(false);
                }}
              >
                {t("chat.message.copyRaw")}
              </button>
              <button
                className="flex w-full cursor-pointer items-center px-3 py-2 text-left text-xs text-text transition-colors hover:bg-bg-elevated-2"
                title={t("chat.message.quoteHint")}
                onClick={() => {
                  onQuote(content);
                  setCopyMenuOpen(false);
                }}
              >
                {t("chat.message.quote")}
              </button>
            </div>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => onDelete(message.id)} disabled={controlsDisabled}>
          <Trash2 size={13} />
          {t("chat.message.delete")}
        </Button>
        {message.role === "assistant" && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRunRecast(message.id, message.activeSwipeIndex)}
              disabled={controlsDisabled}
              title={t("chat.message.runRecastHint")}
            >
              <Sparkles size={13} />
              {t("chat.message.recast")}
            </Button>
            {directorAvailable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRunDirector(message.id)}
                disabled={controlsDisabled}
                title={t("chat.message.runDirectorHint")}
              >
                <Film size={13} />
                {t("chat.message.director")}
              </Button>
            )}
            {message.recast && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenRecast(message.id, message.activeSwipeIndex)}
                disabled={controlsDisabled}
                title={t("chat.message.viewDiffHint")}
              >
                <RotateCcw size={13} />
                {t("chat.message.viewDiff")}
              </Button>
            )}
          </>
        )}
        {canRegenerate && (
          <>
            <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={controlsDisabled}>
              <RefreshCw size={13} />
              {t("chat.message.regenerate")}
            </Button>
            <Button variant="ghost" size="sm" onClick={onContinue} disabled={controlsDisabled} title={t("chat.message.continueHint")}>
              {t("chat.message.continue")}
            </Button>
          </>
        )}
      </div>

      {avatarLightbox && (
        <Modal title={avatarLightbox.name} onClose={() => setAvatarLightbox(null)} size="lg">
          <img
            src={avatarLightbox.url}
            alt={avatarLightbox.name}
            className="mx-auto max-h-[70vh] w-full rounded-md border border-border object-contain"
          />
        </Modal>
      )}
      {eventDetail && <TurnEventDetailModal detail={eventDetail} onClose={() => setEventDetail(null)} />}
      {guardFindingsOpen && hasGuardFindings && guardFindings && (
        <Modal title={t("chat.guard.title")} onClose={() => setGuardFindingsOpen(false)} size="lg">
          <p className="text-xs text-text-muted">
            {t("chat.guard.description")}
          </p>
          <ul className="mt-3 flex max-h-[55vh] flex-col gap-2 overflow-y-auto">
            {guardFindings.map((finding, i) => {
              const severity =
                finding.severity === "high"
                  ? { label: t("chat.guard.severityHigh"), className: "text-danger" }
                  : finding.severity === "medium"
                    ? { label: t("chat.guard.severityMedium"), className: "text-warning" }
                    : { label: t("chat.guard.severityLow"), className: "text-text-muted" };
              return (
                <li key={`${finding.factId}-${i}`} className="rounded-md border border-border bg-bg-elevated-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-semibold ${severity.className}`}>{severity.label}</span>
                    <span className="truncate text-[11px] text-text-faint" title={finding.factId}>
                      {finding.factId}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-sm leading-relaxed text-text">{finding.reason}</p>
                  {finding.excerpt && (
                    <p className="mt-1 break-words text-xs italic leading-relaxed text-text-muted">“{finding.excerpt}”</p>
                  )}
                </li>
              );
            })}
          </ul>
        </Modal>
      )}
      {directorDiagnosticOpen && directorDiagnostics[message.id] && (
        <Modal title={t("chat.director.diagnosticsTitle")} onClose={() => setDirectorDiagnosticOpen(false)} size="lg">
          <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
            <section>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{t("chat.director.receivedResponse")}</h4>
              <pre className="whitespace-pre-wrap rounded-md border border-border bg-bg-elevated-2 p-3 text-xs leading-relaxed text-text">{directorDiagnostics[message.id].response || t("chat.director.emptyResponse")}</pre>
            </section>
            <section>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{t("chat.director.modelReasoning")}</h4>
              <pre className="whitespace-pre-wrap rounded-md border border-border bg-bg-elevated-2 p-3 text-xs leading-relaxed text-text">{directorDiagnostics[message.id].reasoning || t("chat.director.noReasoning")}</pre>
            </section>
          </div>
        </Modal>
      )}
      </div>
    </div>
  );
}
