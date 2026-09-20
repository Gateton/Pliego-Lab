import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Camera, Send, Square, User, UserRound } from "lucide-react";
import { getNpcAvatarUrl } from "../lib/npcTracker";
import { SLASH_COMMANDS } from "../lib/composerCommands";
import { useT } from "../i18n";
import { Button } from "./ui";

export interface ComposerNpc {
  id: string;
  name: string;
  pfp?: string;
  isMainCharacter?: boolean;
}

interface Props {
  disabled: boolean;
  isStreaming: boolean;
  npcReactionProcessing?: boolean;
  directorProcessing?: boolean;
  onCancelDirector?: () => void;
  value: string;
  characterName?: string;
  characterId?: string | null;
  npcs?: ComposerNpc[];
  onChange: (text: string) => void;
  onSend: (text: string) => void;
  onImpersonate: (text: string) => void;
  onStop: () => void;
}


type SuggestionMode = "command" | "mention" | "arg" | null;

interface Suggestion {
  value: string; // what gets inserted (without the leading @ or / — that's added by mode)
  label: string; // what's shown in the dropdown
  hint?: string;
  disabled?: boolean; // informational only — not selectable (e.g. "no NPCs tracked yet")
}

export function Composer({
  disabled,
  isStreaming,
  npcReactionProcessing = false,
  directorProcessing = false,
  onCancelDirector,
  value,
  characterName,
  characterId,
  npcs = [],
  onChange,
  onSend,
  onImpersonate,
  onStop,
}: Props) {
  const t = useT();
  const npcNames = npcs.map((n) => n.name);
  const [asCharacter, setAsCharacter] = useState(false);
  const [mode, setMode] = useState<SuggestionMode>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionStart, setSuggestionStart] = useState<number | null>(null);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const reactionPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!reactionPickerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target as Node)) {
        setReactionPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [reactionPickerOpen]);

  function triggerNpcReaction(npc: ComposerNpc) {
    onSend(`/img ${npc.name}`);
    setReactionPickerOpen(false);
  }

  function clearSuggestions() {
    setMode(null);
    setSuggestions([]);
    setSuggestionStart(null);
  }

  function updateSuggestions(text: string, cursor: number) {
    const before = text.slice(0, cursor);

    // "/" at the very start of the message — list matching slash commands.
    const cmdMatch = before.match(/^\/(\w*)$/);
    if (cmdMatch) {
      const query = cmdMatch[1].toLowerCase();
      const matches = SLASH_COMMANDS.filter((c) => c.command.slice(1).toLowerCase().startsWith(query));
      if (matches.length > 0) {
        setMode("command");
        setSuggestions(matches.map((c) => ({ value: c.command.slice(1), label: `${c.command} ${t(c.argsKey)}`, hint: t(c.descriptionKey) })));
        setSuggestionStart(0);
        return;
      }
    }

    // "/img <partial name>" — the command's own argument is an NPC name, no "@" needed here.
    const argMatch = before.match(/^\/img\s+([\wÀ-ÿ]*)$/i);
    if (argMatch) {
      const query = argMatch[1].toLowerCase();
      const matches = npcNames.filter((n) => n.toLowerCase().startsWith(query)).slice(0, 6);
      setMode("arg");
      setSuggestionStart(cursor - argMatch[1].length);
      setSuggestions(
        matches.length > 0
          ? matches.map((n) => ({ value: n, label: n }))
          : [
              {
                value: "",
                label: npcNames.length === 0 ? t("chat.composer.noNpcs") : t("chat.composer.noNpcMatch"),
                hint: npcNames.length === 0 ? t("chat.composer.noNpcMatchHint") : undefined,
                disabled: true,
              },
            ],
      );
      return;
    }

    // "@Name" mention anywhere in the message.
    const mentionMatch = before.match(/@([\wÀ-ÿ]*)$/);
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      const matches = npcNames.filter((n) => n.toLowerCase().startsWith(query)).slice(0, 6);
      if (matches.length > 0) {
        setMode("mention");
        setSuggestions(matches.map((n) => ({ value: n, label: `@${n}` })));
        setSuggestionStart(cursor - mentionMatch[1].length - 1);
        return;
      }
    }

    clearSuggestions();
  }

  function applySuggestion(suggestion: Suggestion) {
    if (suggestion.disabled) return;
    const el = textareaRef.current;
    if (!el || suggestionStart === null) return;
    const cursor = el.selectionStart;
    const prefix = mode === "mention" ? "@" : mode === "command" ? "/" : "";
    const insertText = `${prefix}${suggestion.value} `;
    const next = `${value.slice(0, suggestionStart)}${insertText}${value.slice(cursor)}`;
    onChange(next);
    clearSuggestions();
    requestAnimationFrame(() => {
      const pos = suggestionStart + insertText.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  useEffect(() => {
    autoResize();
  }, [value]);

  function handleSend() {
    if (!value.trim() || disabled) return;
    if (asCharacter) onImpersonate(value);
    else onSend(value);
    onChange("");
    setAsCharacter(false);
    clearSuggestions();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (suggestions.length > 0 && !suggestions[0].disabled) applySuggestion(suggestions[0]);
      else if (suggestions.length === 0) handleSend();
      return;
    }
    if (e.key === "Escape" && suggestions.length > 0) {
      clearSuggestions();
    }
  }

  return (
    <div className="composer-shell border-t border-border p-3" data-tour="composer">
      <div className="composer-card flex flex-col gap-2">
        <div className="composer-modebar flex items-center gap-1">
          <button
            onClick={() => setAsCharacter(false)}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              asCharacter ? "text-text-faint hover:text-text-muted" : "bg-bg-elevated-2 text-text"
            }`}
          >
            <User size={13} />
            {t("chat.speaker.user")}
          </button>
          <button
            onClick={() => setAsCharacter(true)}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              asCharacter ? "bg-bg-elevated-2 text-text" : "text-text-faint hover:text-text-muted"
            }`}
            title={t("chat.composer.impersonateHint")}
          >
            <UserRound size={13} />
            {t("chat.composer.impersonate", { name: characterName ?? t("chat.speaker.characterFallback") })}
          </button>

          <div ref={reactionPickerRef} className="relative ml-1">
            <button
              onClick={() => setReactionPickerOpen((v) => !v)}
              disabled={disabled}
              className="flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-text-faint transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
              title={t("chat.composer.snapshotHint")}
            >
              <Camera size={13} />
              {t("chat.composer.snapshot")}
            </button>

            {reactionPickerOpen && (
              <div className="absolute bottom-full left-0 z-10 mb-1 w-72 rounded-md border border-border bg-bg-elevated p-3 shadow-lg">
                <p className="mb-3 text-[11px] text-text-faint">
                  {t("chat.composer.snapshotDescription")}
                </p>
                {npcs.length === 0 ? (
                  <p className="text-xs text-text-faint">{t("chat.composer.noNpcs")}.</p>
                ) : (
                  <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: "14rem" }}>
                    {npcs.map((npc) => (
                      <button
                        key={npc.id}
                        onClick={() => triggerNpcReaction(npc)}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-bg-hover"
                      >
                        {getNpcAvatarUrl(npc, characterId, 64) ? (
                          <img src={getNpcAvatarUrl(npc, characterId, 64)} alt={npc.name} className="h-8 w-8 shrink-0 rounded-md border border-border object-cover" />
                        ) : (
                          <div className="h-8 w-8 shrink-0 rounded-md border border-dashed border-border bg-bg" />
                        )}
                        <span className="truncate text-sm text-text">
                          {npc.name}
                          {npc.isMainCharacter && <span className="ml-1 text-[10px] text-accent-2">{t("chat.composer.mainCharacterTag")}</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {npcReactionProcessing && (
          <p className="flex items-center gap-1.5 text-xs text-text-faint">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" />
            {t("chat.composer.directorGeneratingImage")}
          </p>
        )}

        {directorProcessing && (
          <p className="flex items-center gap-1.5 text-xs text-text-faint">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" />
            {t("chat.composer.directorAnalyzing")}
            {onCancelDirector && (
              <button
                onClick={onCancelDirector}
                className="cursor-pointer font-medium text-danger underline-offset-2 hover:underline"
              >
                {t("common.actions.cancel")}
              </button>
            )}
          </p>
        )}

        <div className="relative flex items-end gap-2">
          {suggestions.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 flex flex-col overflow-hidden rounded-md border border-border bg-bg-elevated shadow-lg">
              {suggestions.map((s, i) =>
                s.disabled ? (
                  <div key={`${s.value}-${i}`} className="flex flex-col items-start px-3 py-1.5 text-left text-sm text-text-faint">
                    <span>{s.label}</span>
                    {s.hint && <span className="text-[11px] text-text-faint">{s.hint}</span>}
                  </div>
                ) : (
                  <button
                    key={s.value}
                    onClick={() => applySuggestion(s)}
                    className="flex flex-col items-start px-3 py-1.5 text-left text-sm text-text hover:bg-bg-hover"
                  >
                    <span className="cursor-pointer">{s.label}</span>
                    {s.hint && <span className="text-[11px] text-text-faint">{s.hint}</span>}
                  </button>
                ),
              )}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              updateSuggestions(e.target.value, e.target.selectionStart);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              asCharacter
                ? t("chat.composer.placeholderImpersonate", { name: characterName ?? t("chat.speaker.characterFallbackDefinite") })
                : t("chat.composer.placeholder")
            }
            rows={1}
            disabled={disabled}
            className="composer-input w-full flex-1 resize-none overflow-y-auto rounded-md border border-border bg-bg-elevated-2 px-3 py-2 text-sm
              text-text placeholder:text-text-faint outline-none transition-colors focus:border-accent
              disabled:opacity-60"
          />
          {isStreaming ? (
            <Button variant="danger" onClick={onStop}>
              <Square size={16} />
              {t("chat.composer.stop")}
            </Button>
          ) : (
            <Button variant="primary" onClick={handleSend} disabled={disabled || !value.trim()}>
              <Send size={16} />
              {t("chat.composer.send")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
