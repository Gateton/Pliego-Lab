import { useCallback, useEffect, useRef, useState } from "react";
import * as chatsApi from "../api/chats";
import * as charactersApi from "../api/characters";
import * as personasApi from "../api/personas";
import * as settingsApi from "../api/settings";
import * as presetsApi from "../api/samplingPresets";
import * as comfyInjectApi from "../api/comfyInject";
import * as recastApi from "../api/recast";
import * as estudioApi from "../api/estudio";
import * as directorApi from "../api/imageDirector";
import * as plumaApi from "../api/pluma";
import * as providersApi from "../api/providers";
import * as lorebooksApi from "../api/lorebooks";
import * as activeMemoryApi from "../api/activeMemory";
import { streamChat, type SamplingParams } from "../api/chatStream";
import type { Chat, ChatMessage, RecastData, TurnEvent } from "../types/chat";
import type { CharacterCard } from "../types/character";
import type { Persona } from "../types/persona";
import type { AppSettings } from "../types/settings";
import type { ComfyInjectSettings } from "../types/comfyInject";
import type { GuardReport } from "../types/activeMemory";
import type { RecastPreset, RecastSettings } from "../types/recast";
import type { NpcField, NpcTrackerSettings } from "../types/npcTracker";
import type { CharacterVisualState, DirectorDiagnostic, DirectorStateUpdate, ImageDirectorSettings } from "../types/imageDirector";
import { buildPrompt } from "../lib/promptBuilder";
import { buildRecastPasses } from "../lib/recastPromptBuilder";
import { hasImageMarker, splitTextWithMarkers } from "../lib/imageMarkers";
import { buildPlumaMacro } from "../lib/pluma";
import { buildAddonsMacro } from "../lib/addons";
import { buildNpcTrackerMacro, detectPossibleNewName, extractMentionedNpcs, findNpcByName, normalizeNpcs, scoreNpcRelevance } from "../lib/npcTracker";
import { buildComfyInjectMacro } from "../lib/comfyInjectPrompt";
import { resolvePreset } from "../lib/presetDefaults";
import * as npcTrackerApi from "../api/npcTracker";
import { t } from "../i18n";
import type { ApiError } from "../api/requestError";

// Real Roleplay Suite's README: NPC Bank's "Dynamic Injection: Scans your last 4 messages."
const NPC_RECENCY_WINDOW = 4;

function appendToActiveSwipe(chat: Chat, messageId: string, delta: string): Chat {
  return {
    ...chat,
    messages: chat.messages.map((m) =>
      m.id === messageId
        ? { ...m, swipes: m.swipes.map((s, i) => (i === m.activeSwipeIndex ? s + delta : s)) }
        : m,
    ),
  };
}

/** Sets the reasoning for one swipe (parallel array to `swipes`), empty string = no reasoning. */
function setSwipeReasoning(message: ChatMessage, swipeIndex: number, reasoning: string): ChatMessage {
  const reasonings = (message.reasonings ?? new Array(message.swipes.length).fill("")).slice();
  reasonings[swipeIndex] = reasoning.trim();
  return { ...message, reasonings };
}

function toSamplingParams(
  preset: import("../types/samplingPreset").SamplingPreset,
): SamplingParams {
  const { temperature, top_p, top_k, repetition_penalty, frequency_penalty, presence_penalty, max_tokens, min_p, seed, n, middleOut } =
    preset;
  const transforms = middleOut === "allow" ? ["middle-out"] : middleOut === "forbid" ? [] : undefined;

  // Reasoning now lives on the preset: `reasoningEnabled` controls whether the trace is returned
  // to us, `reasoningEffort` tunes how hard the model thinks. Hybrid reasoning models (e.g.
  // z-ai/glm-4.7-flash) think by default even with no `reasoning` param at all — omitting the
  // field does NOT mean "no reasoning", it means "let the model decide" (usually: reason anyway,
  // silently adding real latency). So when neither is set, explicitly disable reasoning.
  const effort = preset.reasoningEffort ?? "auto";
  const wantsReasoning = preset.reasoningEnabled === true || effort !== "auto";
  const reasoning = wantsReasoning
    ? { effort: effort === "auto" ? undefined : effort, exclude: preset.reasoningEnabled !== true }
    : { enabled: false };
  const verbosity = preset.verbosity && preset.verbosity !== "auto" ? preset.verbosity : undefined;

  return {
    temperature,
    top_p,
    top_k,
    repetition_penalty,
    frequency_penalty,
    presence_penalty,
    max_tokens,
    min_p,
    seed,
    n,
    transforms,
    reasoning,
    verbosity,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Returns null for a deliberate user cancellation — that's not a failure, so callers should
 * skip showing an error banner for it and just treat the turn as if the Director found nothing. */
function describeDirectorError(error: unknown): string | null {
  if (error instanceof DOMException && error.name === "AbortError") return null;
  const msg = error instanceof Error ? error.message : String(error);
  // These two are the backend's own codes, and the API layer keeps them on the error precisely so
  // this does not have to match a sentence that may change wording.
  const code = (error as ApiError | undefined)?.code;
  if (code === "director.disabled") return t("chat.director.error.disabled");
  if (code === "director.noModel") return t("chat.director.error.noModel");
  // Provider messages are not ours, so they are still recognised by their wording.
  if (/is disabled/i.test(msg) && /director/i.test(msg)) return t("chat.director.error.disabled");
  if (/No model configured for Image Director/i.test(msg)) return t("chat.director.error.noModel");
  if (/timed out|timeout/i.test(msg)) return t("chat.director.error.timeout");
  if (/reasoning is mandatory|cannot be disabled/i.test(msg)) return t("chat.director.error.reasoningMandatory");
  if (/openrouter.*failed|request failed/i.test(msg)) return t("chat.director.error.openRouterFailed", { message: msg });
  return t("chat.director.error.failed", { message: msg });
}

const MAX_VISUAL_STATE_HISTORY = 10;

/** Human-readable one-liner for a visual-state delta, for the VisualStatePanel's history list. */
function summarizeVisualStateUpdate(u: DirectorStateUpdate): string {
  const parts: string[] = [];
  if (u.outfitChanged && u.newOutfit) {
    const outfit = u.newOutfit.length > 60 ? `${u.newOutfit.slice(0, 60)}…` : u.newOutfit;
    parts.push(t("chat.director.historyOutfit", { outfit }));
  }
  if (u.stateAdded?.length) parts.push(u.stateAdded.map((s) => `+${s}`).join(", "));
  if (u.stateRemoved?.length) parts.push(u.stateRemoved.map((s) => `-${s}`).join(", "));
  return parts.join(" · ");
}

/** Field-by-field diff between an NPC's before/after `values` — works for a brand-new NPC too
 * (pass `before` as undefined/{}, every filled field then shows as "" → value). Used to give
 * the turn-event pills something concrete to show in their detail modal. */
function buildFieldChanges(fields: NpcField[] | undefined, before: Record<string, string> | undefined, after: Record<string, string>) {
  const labelFor = (key: string) => fields?.find((f) => f.key === key)?.label ?? key;
  const keys = new Set([...(before ? Object.keys(before) : []), ...Object.keys(after)]);
  const changes: { key: string; label: string; before: string; after: string }[] = [];
  for (const key of keys) {
    const b = before?.[key] ?? "";
    const a = after[key] ?? "";
    if (b !== a) changes.push({ key, label: labelFor(key), before: b, after: a });
  }
  return changes;
}

export function useChat(chatId: string | null, onPersisted?: () => void) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [character, setCharacter] = useState<CharacterCard | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  // `settings` is kept as state (read as a "loaded at least once" gate in sendMessage/
  // regenerate); the rest of the settings families below this point are consumed exclusively
  // through the fresh snapshot `refreshAllSettings()` returns right before each generation —
  // see its comment — so only the families another component actually renders
  // (npcTrackerSettings, returned from this hook) still live in state here.
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [comfyInjectSettings, setComfyInjectSettings] = useState<ComfyInjectSettings | null>(null);
  const [npcTrackerSettings, setNpcTrackerSettings] = useState<NpcTrackerSettings | null>(null);
  const [imageDirectorSettings, setImageDirectorSettings] = useState<ImageDirectorSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [imagesGenerating, setImagesGenerating] = useState<Set<string>>(new Set());
  const [recastProcessing, setRecastProcessing] = useState<Set<string>>(new Set());
  const [directorProcessing, setDirectorProcessing] = useState<Set<string>>(new Set());
  const [directorErrors, setDirectorErrors] = useState<Record<string, string>>({});
  const [directorDiagnostics, setDirectorDiagnostics] = useState<Record<string, DirectorDiagnostic>>({});
  const [visualStateCheckProcessing, setVisualStateCheckProcessing] = useState(false);
  const [visualStateCheckResult, setVisualStateCheckResult] = useState<string | null>(null);
  const [npcReactionProcessing, setNpcReactionProcessing] = useState(false);
  const [recastModalKey, setRecastModalKey] = useState<string | null>(null);
  // Continuity Guard findings, keyed by the message they belong to. ChatView renders one notice
  // per message and can clear a single one through `dismissGuard` without waiting for a re-check.
  const [memoryGuardFindings, setMemoryGuardFindings] = useState<Record<string, GuardReport>>({});
  // Bumped whenever a background memory call changed the ledger (invalidation, extraction, guard).
  // The memory panel lives in ChatView, so it needs a signal to re-read: without it, the badge kept
  // showing the pre-edit ledger until something else happened to refresh it.
  const [memorySyncToken, setMemorySyncToken] = useState(0);

  const chatRef = useRef<Chat | null>(null);
  useEffect(() => {
    chatRef.current = chat;
  }, [chat]);

  const isStreamingRef = useRef(isStreaming);
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const directorAbortControllerRef = useRef<AbortController | null>(null);

  // Serializes NPC Tracker's scan (auto-scan + heuristic-scan) and evolution operations: they're
  // all fired independently after each message and can all read/write `chat.npcs` concurrently.
  // Chaining them onto one queue means a second trigger always starts after the first has fully
  // applied its setChat, so they can never race and silently drop each other's result.
  const npcOpsQueueRef = useRef<Promise<void>>(Promise.resolve());
  const enqueueNpcOp = useCallback((fn: () => Promise<void>): Promise<void> => {
    const next = npcOpsQueueRef.current.then(fn, fn);
    npcOpsQueueRef.current = next;
    return next;
  }, []);
  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // Cancels an in-flight Image Director call (auto-run or manual "Retaguear") — e.g. the main
  // model refused/produced nothing worth illustrating, no point burning tokens tagging it.
  const cancelDirector = useCallback(() => {
    directorAbortControllerRef.current?.abort();
  }, []);

  const refreshCharacter = useCallback(async () => {
    const currentChat = chatRef.current;
    if (!currentChat?.characterId) return;
    try {
      setCharacter(await charactersApi.getCharacter(currentChat.characterId));
    } catch {
      // Character was deleted while the editor was open — leave the last-known copy in place.
    }
  }, []);

  const characterRef = useRef<CharacterCard | null>(null);
  useEffect(() => {
    characterRef.current = character;
  }, [character]);

  const personaRef = useRef<Persona | null>(null);
  useEffect(() => {
    personaRef.current = persona;
  }, [persona]);

  const onPersistedRef = useRef(onPersisted);
  onPersistedRef.current = onPersisted;

  const savingRef = useRef(false);
  const pendingRef = useRef<Chat | null>(null);

  const flush = useCallback(async () => {
    const toSave = pendingRef.current;
    if (!toSave) return;
    pendingRef.current = null;
    savingRef.current = true;
    try {
      await chatsApi.updateChat(toSave.id, {
        title: toSave.title,
        messages: toSave.messages,
        extensionData: toSave.extensionData,
        npcs: toSave.npcs,
        npcTracker: toSave.npcTracker,
        personaId: toSave.personaId,
        variables: toSave.variables,
        visualState: toSave.visualState,
      });
      onPersistedRef.current?.();
    } catch {
      // Best-effort persistence: a later action will schedule a fresh save anyway.
    } finally {
      savingRef.current = false;
      if (pendingRef.current) flush();
    }
  }, []);

  const scheduleSave = useCallback(
    (next: Chat) => {
      pendingRef.current = next;
      if (!savingRef.current) flush();
    },
    [flush],
  );

  // Memoria Viva can be citing a text that no longer exists after an edit / deletion / swipe
  // change, so those three paths mark the affected message for review. Fire-and-forget on
  // purpose: the local change is already applied and persisted, and a slow or failed call must
  // never delay the UI or lose the user's action.
  const invalidateMemory = useCallback((messageIds: string[], reason: string) => {
    const targetChatId = chatRef.current?.id;
    if (!targetChatId || messageIds.length === 0) return;
    void activeMemoryApi
      .invalidateMemory(targetChatId, { messageIds, reason })
      .then(() => setMemorySyncToken((token) => token + 1))
      .catch((error) => {
        console.warn(`[Active memory] invalidation failed (${reason}):`, error);
      });
  }, []);

  const dismissGuard = useCallback((messageId: string) => {
    setMemoryGuardFindings((prev) => {
      if (!(messageId in prev)) return prev;
      const next = { ...prev };
      delete next[messageId];
      return next;
    });
  }, []);


  // Global settings + active sampling preset + ComfyInject/Recast/Roleplay settings live for the
  // whole app session (useChat is mounted once at the top level, not per-chat — see App.tsx),
  // so a change made in a settings screen while a chat is already open would never be picked up
  // without this: every generation re-fetches everything fresh right before it's used, instead
  // of relying on whatever was loaded on first mount. Also called once on mount for the initial
  // load and to feed screens that just display these settings (Composer, etc.).
  const refreshAllSettings = useCallback(async () => {
    const [
      loadedSettings,
      presets,
      loadedComfySettings,
      loadedRecastSettings,
      loadedRecastPresets,
      loadedAddonsSettings,
      loadedNpcTrackerSettings,
      loadedImageDirectorSettings,
      loadedPlumaSettings,
    ] = await Promise.all([
      settingsApi.getSettings(),
      presetsApi.listSamplingPresets(),
      comfyInjectApi.getSettings(),
      recastApi.getSettings(),
      recastApi.listPresets(),
      estudioApi.getAddonsSettings(),
      npcTrackerApi.getNpcTrackerSettings(),
      directorApi.getImageDirectorSettings().catch(() => null),
      plumaApi.getPlumaSettings().catch(() => null),
    ]);
    const activePresetLoaded = resolvePreset(presets, loadedSettings.activeSamplingPresetId);
    const freshSamplingParams = toSamplingParams(activePresetLoaded);

    setSettings(loadedSettings);
    setComfyInjectSettings(loadedComfySettings);
    setNpcTrackerSettings(loadedNpcTrackerSettings);
    setImageDirectorSettings(loadedImageDirectorSettings);

    return {
      settings: loadedSettings,
      activePreset: activePresetLoaded,
      samplingParams: freshSamplingParams,
      comfyInjectSettings: loadedComfySettings,
      recastSettings: loadedRecastSettings,
      recastPresets: loadedRecastPresets,
      addonsSettings: loadedAddonsSettings,
      npcTrackerSettings: loadedNpcTrackerSettings,
      imageDirectorSettings: loadedImageDirectorSettings,
      plumaSettings: loadedPlumaSettings,
    };
  }, []);

  useEffect(() => {
    refreshAllSettings();
  }, [refreshAllSettings]);

  useEffect(() => {
    setRecastModalKey(null);
    if (!chatId) {
      setChat(null);
      setCharacter(null);
      setPersona(null);
      return;
    }
    setIsLoading(true);
    setStreamError(null);

    chatsApi
      .getChat(chatId)
      .then(async (loadedChat) => {
        setChat({ ...loadedChat, npcs: normalizeNpcs(loadedChat.npcs) });

        if (loadedChat.characterId) {
          try {
            setCharacter(await charactersApi.getCharacter(loadedChat.characterId));
          } catch {
            setCharacter(null); // Character was deleted after this chat was created — fall back to raw mode.
          }
        } else {
          setCharacter(null);
        }

        if (loadedChat.personaId) {
          const personas = await personasApi.listPersonas();
          setPersona(personas.find((p) => p.id === loadedChat.personaId) ?? null);
        } else {
          setPersona(null);
        }
      })
      .finally(() => setIsLoading(false));
  }, [chatId]);

  const markGenerating = useCallback((key: string, generating: boolean) => {
    setImagesGenerating((prev) => {
      const next = new Set(prev);
      if (generating) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  // Merges resolved images into a message, keyed `${swipeIndex}:${markerIndex}`. Discards
  // the result if the chat changed or the message was deleted while this was in flight.
  const mergeImageResults = useCallback(
    (targetChatId: string, messageId: string, keyed: Record<string, import("../types/comfyInject").GeneratedImageResult>) => {
      if (chatRef.current?.id !== targetChatId) return;
      setChat((prev) => {
        if (!prev) return prev;
        const message = prev.messages.find((m) => m.id === messageId);
        if (!message) return prev;
        const nextChat: Chat = {
          ...prev,
          messages: prev.messages.map((m) => (m.id === messageId ? { ...m, images: { ...m.images, ...keyed } } : m)),
        };
        scheduleSave(nextChat);
        return nextChat;
      });
    },
    [scheduleSave],
  );

  const processMessageImages = useCallback(
    async (targetChatId: string, messageId: string, swipeIndex: number, text: string, indexOffset = 0) => {
      if (!hasImageMarker(text)) return;
      console.log("[ComfyInject] processMessageImages called — has marker");

      // comfyInjectSettings is only loaded once when the chat mounts — if the user flips the
      // enabled toggle (or changes checkpoint/host) in Settings while this chat is already
      // open, that stale snapshot would otherwise silently keep saying "disabled" until a
      // full page reload. Re-check against the real, current settings instead of trusting it.
      const freshSettings = await comfyInjectApi.getSettings().catch((e) => {
        console.error("[ComfyInject] getSettings failed:", e);
        return null;
      });
      if (freshSettings) setComfyInjectSettings(freshSettings);
      if (!(freshSettings ?? comfyInjectSettings)?.enabled) {
        console.warn("[ComfyInject] skipping — disabled or settings unavailable", {
          fresh: freshSettings?.enabled,
          state: comfyInjectSettings?.enabled,
        });
        return;
      }

      const genKey = `${messageId}:${swipeIndex}`;
      markGenerating(genKey, true);
      try {
        const results = await comfyInjectApi.processMessage(text, targetChatId, messageId);
        console.log("[ComfyInject] processMessage returned", results.length, "results:", results.map((r) => r.status).join(","));
        const keyed: Record<string, import("../types/comfyInject").GeneratedImageResult> = {};
        results.forEach((result, i) => {
          // Skip transient generation failures (e.g. ComfyUI not running) during auto-generation:
          // leave the marker unresolved so the "Generar imagen" button stays, instead of replacing
          // it with an error the user never asked for. Manual clicks still surface the error.
          if (result.status === "generation_error") return;
          keyed[`${swipeIndex}:${i + indexOffset}`] = result;
        });
        mergeImageResults(targetChatId, messageId, keyed);
      } catch (e) {
        console.error("[ComfyInject] processMessage FAILED:", e);
      } finally {
        markGenerating(genKey, false);
      }
    },
    [comfyInjectSettings, markGenerating, mergeImageResults],
  );

  const retryMarker = useCallback(
    async (messageId: string, markerKey: string, rawMarker: string) => {
      const targetChatId = chatRef.current?.id;
      if (!targetChatId) return;
      // Per-marker key (not per-swipe): regenerating one image must not disable the
      // regenerate button on every other image in the same message/swipe, since ComfyUI
      // can happily queue several generations at once.
      const genKey = `${messageId}:${markerKey}`;

      markGenerating(genKey, true);
      try {
        const result = await comfyInjectApi.retryMarker(rawMarker, targetChatId, messageId);
        mergeImageResults(targetChatId, messageId, { [markerKey]: result });
      } catch (e) {
        console.error("[ComfyInject] retryMarker FAILED:", e);
      } finally {
        markGenerating(genKey, false);
      }
    },
    [markGenerating, mergeImageResults],
  );

  // Generates a single marker on demand (e.g. ComfyUI wasn't running when the message was
  // first generated) — respects the marker's own seed token rather than forcing RANDOM.
  const generateMarker = useCallback(
    async (messageId: string, markerKey: string, rawMarker: string) => {
      const targetChatId = chatRef.current?.id;
      if (!targetChatId) return;
      // Per-marker key — see retryMarker above.
      const genKey = `${messageId}:${markerKey}`;

      markGenerating(genKey, true);
      try {
        const result = await comfyInjectApi.generateMarker(rawMarker, targetChatId, messageId);
        mergeImageResults(targetChatId, messageId, { [markerKey]: result });
      } catch (e) {
        console.error("[ComfyInject] generateMarker FAILED:", e);
      } finally {
        markGenerating(genKey, false);
      }
    },
    [markGenerating, mergeImageResults],
  );

  const markRecastProcessing = useCallback((key: string, processing: boolean) => {
    setRecastProcessing((prev) => {
      const next = new Set(prev);
      if (processing) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  // Overwrites one swipe's text with Recast's output. Discards the result if the chat
  // changed or the message was deleted while this was in flight (same guard as ComfyInject).
  const applyRecastText = useCallback(
    (targetChatId: string, messageId: string, swipeIndex: number, text: string) => {
      if (chatRef.current?.id !== targetChatId) return;
      setChat((prev) => {
        if (!prev) return prev;
        const message = prev.messages.find((m) => m.id === messageId);
        if (!message) return prev;
        const nextChat: Chat = {
          ...prev,
          messages: prev.messages.map((m) =>
            m.id === messageId ? { ...m, swipes: m.swipes.map((s, i) => (i === swipeIndex ? text : s)) } : m,
          ),
        };
        scheduleSave(nextChat);
        return nextChat;
      });
    },
    [scheduleSave],
  );

  // Stores the recast result (original vs transformed + per-pass snapshots) on the message,
  // so the diff can be reopened later. Persisted with the chat.
  const storeRecastData = useCallback(
    (targetChatId: string, messageId: string, recastData: RecastData) => {
      if (chatRef.current?.id !== targetChatId) return;
      setChat((prev) => {
        if (!prev) return prev;
        const message = prev.messages.find((m) => m.id === messageId);
        if (!message) return prev;
        const nextChat: Chat = {
          ...prev,
          messages: prev.messages.map((m) => (m.id === messageId ? { ...m, recast: recastData } : m)),
        };
        scheduleSave(nextChat);
        return nextChat;
      });
    },
    [scheduleSave],
  );

  // Shared core: builds the enabled passes, runs the pipeline, and stores the result on the
  // message. Returns true when a (changed) proposal was staged. Used by both the auto-run path
  // and the manual per-message trigger.
  const runRecastForMessage = useCallback(
    async (
      chatNow: Chat,
      messageId: string,
      swipeIndex: number,
      text: string,
      recastSettingsNow: RecastSettings,
      recastPresetsNow: RecastPreset[],
      prefix = "",
    ): Promise<boolean> => {
      const preset = recastPresetsNow.find((p) => p.id === recastSettingsNow.activePresetId);
      if (!preset) {
        console.warn("[Recast] active preset not found (stale id). Re-select it in the Recast settings.");
        return false;
      }
      if (text.trim().length < recastSettingsNow.minChars) return false;
      const passes = buildRecastPasses(preset, recastSettingsNow, chatNow, messageId, character, persona);
      if (passes.length === 0) return false;
      const passNames = preset.passes.filter((p) => p.enabled).map((p) => p.name);
      const genKey = `${messageId}:${swipeIndex}`;
      markRecastProcessing(genKey, true);
      try {
        const { text: finalText, snapshots } = await recastApi.process(text, passes, chatNow.id);
        if (finalText !== text && chatRef.current?.id === chatNow.id) {
          storeRecastData(chatNow.id, messageId, { prefix, original: text, transformed: finalText, snapshots, passNames });
          return true;
        }
        return false;
      } catch (e) {
        console.error("[Recast] process failed:", e);
        return false;
      } finally {
        markRecastProcessing(genKey, false);
      }
    },
    [character, persona, markRecastProcessing, storeRecastData],
  );

  // Auto-run path (called from runGeneration.onDone). Returns the ORIGINAL text so ComfyInject/
  // Memory/NPC Bank keep processing it unchanged; the proposal is staged on the message.
  const processRecast = useCallback(
    async (
      targetChatId: string,
      targetMessageId: string,
      swipeIndex: number,
      text: string,
      recastSettingsNow: RecastSettings | null,
      recastPresetsNow: RecastPreset[],
      prefix = "",
    ): Promise<string> => {
      if (!recastSettingsNow?.enabled) return text;
      if (!recastSettingsNow.autoRun) return text;
      const chatNow = chatRef.current;
      if (!chatNow || chatNow.id !== targetChatId) return text;
      const staged = await runRecastForMessage(chatNow, targetMessageId, swipeIndex, text, recastSettingsNow, recastPresetsNow, prefix);
      if (staged) setRecastModalKey(`${targetMessageId}:${swipeIndex}`);
      return text;
    },
    [runRecastForMessage],
  );

  // Manual trigger: run Recast on a specific message now (per-message button).
  const runRecastOnMessage = useCallback(
    async (messageId: string, swipeIndex: number) => {
      const chatNow = chatRef.current;
      if (!chatNow || isStreaming) return;
      const message = chatNow.messages.find((m) => m.id === messageId);
      const text = message?.swipes[swipeIndex];
      if (!text?.trim()) return;
      const fresh = await refreshAllSettings();
      const staged = await runRecastForMessage(chatNow, messageId, swipeIndex, text, fresh.recastSettings, fresh.recastPresets);
      if (staged) setRecastModalKey(`${messageId}:${swipeIndex}`);
    },
    [isStreaming, refreshAllSettings, runRecastForMessage],
  );

  const openRecastModal = useCallback((messageId: string, swipeIndex: number) => {
    setRecastModalKey(`${messageId}:${swipeIndex}`);
  }, []);

  const closeRecastModal = useCallback(() => {
    setRecastModalKey(null);
  }, []);

  // Accept: apply the transformed (or user-edited) text to the swipe; keep the recast data so
  // the diff can be reopened/reverted.
  const acceptRecast = useCallback(
    (messageId: string, swipeIndex: number, newText?: string) => {
      const chatNow = chatRef.current;
      if (!chatNow) return;
      const message = chatNow.messages.find((m) => m.id === messageId);
      if (!message?.recast) return;
      const text = (message.recast.prefix ?? "") + (newText ?? message.recast.transformed);
      applyRecastText(chatNow.id, messageId, swipeIndex, text);
      if (newText) {
        storeRecastData(chatNow.id, messageId, { ...message.recast, transformed: newText });
      }
    },
    [applyRecastText, storeRecastData],
  );

  // Reject: revert the swipe to the original (pre-Recast) text.
  const rejectRecast = useCallback(
    (messageId: string, swipeIndex: number) => {
      const chatNow = chatRef.current;
      if (!chatNow) return;
      const message = chatNow.messages.find((m) => m.id === messageId);
      if (!message?.recast) return;
      applyRecastText(chatNow.id, messageId, swipeIndex, (message.recast.prefix ?? "") + message.recast.original);
    },
    [applyRecastText],
  );

  // Overwrites the chat's NPC roster (used by the roster UI for manual edits). Discards if the
  // chat changed while this was in flight (same staleness guard as applyRecastText).
  const applyNpcs = useCallback(
    (targetChatId: string, npcs: NonNullable<Chat["npcs"]>) => {
      if (chatRef.current?.id !== targetChatId) return;
      setChat((prev) => {
        if (!prev) return prev;
        const nextChat: Chat = { ...prev, npcs };
        scheduleSave(nextChat);
        return nextChat;
      });
    },
    [scheduleSave],
  );

  const updateNpcs = useCallback(
    (npcs: NonNullable<Chat["npcs"]>) => {
      if (!chatRef.current) return;
      applyNpcs(chatRef.current.id, npcs);
    },
    [applyNpcs],
  );

  // Manual edits to the Image Director's persistent visual-state ledger (VisualStatePanel).
  const updateVisualState = useCallback(
    (visualState: NonNullable<Chat["visualState"]>) => {
      if (!chatRef.current) return;
      setChat((prev) => {
        if (!prev) return prev;
        const nextChat: Chat = { ...prev, visualState };
        scheduleSave(nextChat);
        return nextChat;
      });
    },
    [scheduleSave],
  );

  // Permanent, never-cleared log of automatic background events (new NPC, NPC evolved, visual
  // state changed) shown as pills under the message that triggered them — a record of "what
  // happened this turn", not a transient toast.
  const pushEvent = useCallback(
    (messageId: string, event: TurnEvent) => {
      setChat((prev) => {
        if (!prev) return prev;
        const nextChat: Chat = {
          ...prev,
          messages: prev.messages.map((m) => (m.id === messageId ? { ...m, events: [...(m.events ?? []), event] } : m)),
        };
        scheduleSave(nextChat);
        return nextChat;
      });
    },
    [scheduleSave],
  );

  // Scans the chat for NPCs (full or incremental) and applies the merged roster + scan position.
  // Queued through enqueueNpcOp so a concurrent trigger (auto-scan + heuristic-scan can both
  // fire for the same message) never runs against the same stale snapshot as this one.
  const scanNpcs = useCallback(
    (mode: "full" | "auto", messageId?: string) =>
      enqueueNpcOp(async () => {
        const current = chatRef.current;
        if (!current) return;
        const sinceIndex = mode === "auto" ? (current.npcTracker?.lastScannedCount ?? 0) : 0;
        try {
          const result = await npcTrackerApi.scanChatNpcs(current.id, {
            characterName: characterRef.current?.name,
            personaName: personaRef.current?.name,
            sinceIndex,
          });
          if (chatRef.current?.id !== current.id) return;
          if (messageId) {
            const existingIds = new Set((current.npcs ?? []).map((n) => n.id));
            for (const npc of result.npcs) {
              if (!existingIds.has(npc.id)) {
                const changes = buildFieldChanges(npcTrackerSettings?.fields, undefined, npc.values);
                pushEvent(messageId, {
                  text: t("chat.events.npcAdded", { name: npc.name }),
                  detail: { kind: "npc_added", npcName: npc.name, changes },
                });
              }
            }
          }
          setChat((prev) => {
            if (!prev) return prev;
            const nextChat: Chat = { ...prev, npcs: result.npcs, npcTracker: { lastScannedCount: prev.messages.length } };
            scheduleSave(nextChat);
            return nextChat;
          });
        } catch (error) {
          console.error("[NPC Tracker] scan failed:", error);
        }
      }),
    [scheduleSave, pushEvent, npcTrackerSettings, enqueueNpcOp],
  );

  // Changes the active chat's persona (persisted + reflected in the {{user}}/{{persona}} macros).
  const setChatPersona = useCallback(
    async (personaId: string | null) => {
      if (!chatRef.current) return;
      const nextChat: Chat = { ...chatRef.current, personaId };
      setChat(nextChat);
      scheduleSave(nextChat);
      if (personaId) {
        const personas = await personasApi.listPersonas();
        setPersona(personas.find((p) => p.id === personaId) ?? null);
      } else {
        setPersona(null);
      }
    },
    [scheduleSave],
  );

  const setChatLorebook = useCallback(
    (lorebookId: string | null) => {
      if (!chatRef.current) return;
      const extensionData = { ...(chatRef.current.extensionData ?? {}) };
      if (lorebookId) extensionData.lorebookId = lorebookId;
      else delete extensionData.lorebookId;
      const nextChat: Chat = { ...chatRef.current, extensionData };
      setChat(nextChat);
      scheduleSave(nextChat);
    },
    [scheduleSave],
  );

  // Changes the active chat's custom variables ({{clave}} placeholders — optional feature).
  const setChatVariables = useCallback(
    (variables: Record<string, string>) => {
      if (!chatRef.current) return;
      const nextChat: Chat = { ...chatRef.current, variables };
      setChat(nextChat);
      scheduleSave(nextChat);
    },
    [scheduleSave],
  );

  // NPC Tracker auto-scan trigger — runs after a message settles when autoScan is enabled and
  // the configured interval has elapsed since the last scan.
  const runAutoScan = useCallback(
    async (targetChatId: string, trackerSettings: NpcTrackerSettings | null, messageId?: string) => {
      if (!trackerSettings?.enabled || !trackerSettings.autoScan) return;
      const current = chatRef.current;
      if (!current || current.id !== targetChatId) return;
      const count = current.messages.length;
      const last = current.npcTracker?.lastScannedCount ?? 0;
      if (count - last < Math.max(1, trackerSettings.autoScanInterval)) return;
      await scanNpcs("auto", messageId);
    },
    [scanNpcs],
  );

  // NPC Tracker heuristic auto-scan trigger — zero-token local text heuristic (no LLM call)
  // gates the (already incremental/cheap) scan, instead of firing it on a fixed message
  // interval regardless of whether a new character actually showed up.
  const runHeuristicScan = useCallback(
    async (targetChatId: string, trackerSettings: NpcTrackerSettings | null, text: string, messageId?: string) => {
      if (!trackerSettings?.enabled || !trackerSettings.heuristicScan) return;
      const current = chatRef.current;
      if (!current || current.id !== targetChatId) return;
      const excludeNames = [characterRef.current?.name, personaRef.current?.name].filter(
        (s): s is string => Boolean(s),
      );
      if (!detectPossibleNewName(text, current.npcs ?? [], excludeNames)) return;
      await scanNpcs("auto", messageId);
    },
    [scanNpcs],
  );

  // NPC Tracker auto-evolution trigger — separate from scanNpcs/runAutoScan: this one CAN
  // overwrite already-filled fields when the model reports a genuine change, so it only fires
  // on its own toggle+interval and only against a roster that already has at least one NPC.
  // Queued through the same enqueueNpcOp as scanNpcs — evolution and scans both read/write
  // `chat.npcs`, so they must never run concurrently against each other either.
  const runNpcEvolution = useCallback(
    (targetChatId: string, trackerSettings: NpcTrackerSettings | null, messageId?: string) =>
      enqueueNpcOp(async () => {
        if (!trackerSettings?.enabled || !trackerSettings.evolutionEnabled) return;
        const current = chatRef.current;
        if (!current || current.id !== targetChatId) return;
        if (!current.npcs || current.npcs.length === 0) return;
        const count = current.messages.length;
        const last = current.npcTracker?.lastEvolvedCount ?? 0;
        if (count - last < Math.max(1, trackerSettings.evolutionInterval)) return;
        try {
          const result = await npcTrackerApi.evolveChatNpcs(current.id, { sinceIndex: last });
          if (chatRef.current?.id !== current.id) return;
          if (messageId) {
            const before = new Map(current.npcs.map((n) => [n.id, n.values]));
            for (const npc of result.npcs) {
              const prevValues = before.get(npc.id);
              if (!prevValues) continue;
              const changes = buildFieldChanges(trackerSettings.fields, prevValues, npc.values);
              if (changes.length > 0) {
                pushEvent(messageId, {
                  text:
                    changes.length === 1
                      ? t("chat.events.npcEvolvedOne", { name: npc.name })
                      : t("chat.events.npcEvolvedMany", { name: npc.name, count: changes.length }),
                  detail: { kind: "npc_evolved", npcName: npc.name, changes },
                });
              }
            }
          }
          setChat((prev) => {
            if (!prev) return prev;
            const nextChat: Chat = {
              ...prev,
              npcs: result.npcs,
              npcTracker: { lastScannedCount: prev.npcTracker?.lastScannedCount ?? 0, lastEvolvedCount: prev.messages.length },
            };
            scheduleSave(nextChat);
            return nextChat;
          });
        } catch (error) {
          console.error("[NPC Tracker] evolve failed:", error);
        }
      }),
    [scheduleSave, pushEvent, enqueueNpcOp],
  );

  // Manual "Evolucionar" button in the NPC roster modal — same evolveNpcDossiers call as the
  // automatic trigger above, but ignores the evolutionEnabled toggle/interval gate (an explicit
  // click is its own permission) and always looks at the last `evolutionInterval` messages
  // (or the whole chat if it's shorter than that) rather than "since the last automatic run".
  const evolveNpcsManually = useCallback(async (): Promise<number> => {
    const current = chatRef.current;
    if (!current || !current.npcs || current.npcs.length === 0) return 0;
    const interval = Math.max(1, npcTrackerSettings?.evolutionInterval ?? 20);
    const sinceIndex = Math.max(0, current.messages.length - interval);
    const result = await npcTrackerApi.evolveChatNpcs(current.id, { sinceIndex });
    if (chatRef.current?.id !== current.id) return result.changed;
    setChat((prev) => {
      if (!prev) return prev;
      const nextChat: Chat = {
        ...prev,
        npcs: result.npcs,
        npcTracker: { lastScannedCount: prev.npcTracker?.lastScannedCount ?? 0, lastEvolvedCount: prev.messages.length },
      };
      scheduleSave(nextChat);
      return nextChat;
    });
    return result.changed;
  }, [scheduleSave, npcTrackerSettings]);

  // ─── Image Director helpers ────────────────────────────────────────────────
  // Tags `text` with the Director model (character + NPC + recent-message context).
  // Returns the tagged text, or the original if unchanged/errored.
  // Merges the Director's per-turn outfit/state deltas into the persistent ledger — plain,
  // deterministic code, so the ledger stays correct even if the model skips a delta some turn.
  const applyVisualStateUpdates = useCallback(
    (updates: DirectorStateUpdate[], messageId?: string) => {
      const current = chatRef.current;
      if (!current) return;
      const nextState: Record<string, CharacterVisualState> = { ...(current.visualState ?? {}) };
      for (const u of updates) {
        if (!u.character) continue;
        const existing = nextState[u.character] ?? { outfit: "", state: [], updatedAt: 0 };
        const stateSet = new Set(existing.state);
        for (const s of u.stateAdded ?? []) stateSet.add(s);
        for (const s of u.stateRemoved ?? []) stateSet.delete(s);
        const now = Date.now();
        const summary = summarizeVisualStateUpdate(u);
        const history = summary
          ? [...(existing.history ?? []), { timestamp: now, summary }].slice(-MAX_VISUAL_STATE_HISTORY)
          : existing.history;
        nextState[u.character] = {
          outfit: u.outfitChanged && u.newOutfit ? u.newOutfit : existing.outfit,
          state: [...stateSet],
          updatedAt: now,
          ...(history ? { history } : {}),
        };
        if (messageId && summary) {
          const changes: { key: string; label: string; before: string; after: string }[] = [];
          if (u.outfitChanged && u.newOutfit) {
            changes.push({
              key: "outfit",
              label: t("chat.director.change.outfit"),
              before: existing.outfit || t("chat.director.change.noneBefore"),
              after: u.newOutfit,
            });
          }
          for (const s of u.stateAdded ?? []) changes.push({ key: `state:${s}`, label: t("chat.director.change.stateAdded"), before: "", after: s });
          for (const s of u.stateRemoved ?? []) changes.push({ key: `state:${s}`, label: t("chat.director.change.stateRemoved"), before: s, after: "" });
          pushEvent(messageId, {
            text: t("chat.events.visualState", { character: u.character, summary }),
            detail: { kind: "visual_state", npcName: u.character, changes },
          });
        }
      }
      const nextChat: Chat = { ...current, visualState: nextState };
      setChat(nextChat);
      scheduleSave(nextChat);
    },
    [scheduleSave, pushEvent],
  );

  const tagWithDirector = useCallback(
    async (text: string, settings: ImageDirectorSettings | null | undefined, messageId?: string): Promise<string> => {
      const chatNow = chatRef.current;
      const depth = settings?.contextDepth ?? 0;
      const context: import("./useImageDirector").DirectorRunContext = { chatId: chatNow?.id };
      if (character) {
        context.character = {
          name: character.name,
          description: character.description,
          personality: character.personality,
          scenario: character.scenario,
          imageTags: character.imageTags || "",
        };
      }
      if (settings?.includePersonaContext && persona?.values?.imageTags) {
        context.persona = { name: persona.name, imageTags: persona.values.imageTags };
      }
      const recentTexts = depth > 0 && chatNow ? chatNow.messages.slice(-depth).map((m) => m.swipes[m.activeSwipeIndex]) : [];
      if (chatNow?.npcs?.length) {
        // Soft tiering, never a hard exclude: an NPC referred to only by pronoun in the current
        // beat still scores via a name mention a few recent messages back. NPCs that don't match
        // anything are still sent, just compacted to their image-tag baseline instead of a full
        // dossier, so nothing known is ever silently dropped.
        const combinedText = [text, ...recentTexts].join("\n");
        const relevantNames = new Set(scoreNpcRelevance(chatNow.npcs, combinedText).map((s) => s.npc.name));
        context.npcs = chatNow.npcs.map((npc) =>
          relevantNames.has(npc.name)
            ? { name: npc.name, values: npc.values }
            : { name: npc.name, values: npc.values.imageTags ? { imageTags: npc.values.imageTags } : {} },
        );
      }
      if (depth > 0 && chatNow) {
        context.recentMessages = chatNow.messages.slice(-depth).map((m) => ({ role: m.role, content: m.swipes[m.activeSwipeIndex] }));
      }
      if (chatNow?.visualState) {
        context.visualState = chatNow.visualState;
      }
      const controller = new AbortController();
      directorAbortControllerRef.current = controller;
      try {
        const { taggedText, stateUpdates, diagnostic } = await withTimeout(
          directorApi.runImageDirector(text, context, controller.signal),
          Math.max(30, settings?.directorTimeoutSeconds ?? 240) * 1000,
          t("chat.director.moduleName"),
        );
        if (messageId) setDirectorDiagnostics((prev) => ({ ...prev, [messageId]: diagnostic }));
        if (stateUpdates?.length) applyVisualStateUpdates(stateUpdates, messageId);
        return taggedText && taggedText !== text ? taggedText : text;
      } finally {
        directorAbortControllerRef.current = null;
      }
    },
    [character, persona, applyVisualStateUpdates],
  );

  // Overwrites a swipe's text with `fullText`, clearing its resolved images (stale tags).
  const applyDirectorText = useCallback(
    (targetChatId: string, messageId: string, swipeIndex: number, fullText: string) => {
      if (chatRef.current?.id !== targetChatId) return;
      setChat((prev) => {
        if (!prev) return prev;
        const message = prev.messages.find((m) => m.id === messageId);
        if (!message) return prev;
        const prefix = `${swipeIndex}:`;
        const images = message.images
          ? Object.fromEntries(Object.entries(message.images).filter(([key]) => !key.startsWith(prefix)))
          : message.images;
        const nextChat: Chat = {
          ...prev,
          messages: prev.messages.map((m) =>
            m.id === messageId
              ? { ...m, swipes: m.swipes.map((s, i) => (i === swipeIndex ? fullText : s)), images }
              : m,
          ),
        };
        scheduleSave(nextChat);
        return nextChat;
      });
    },
    [scheduleSave],
  );

  interface GenerationContext {
    settings: AppSettings;
    samplingParams: SamplingParams;
    model: string | undefined;
    recastSettings: RecastSettings | null;
    recastPresets: RecastPreset[];
    npcTrackerSettings: NpcTrackerSettings | null;
    imageDirectorSettings: ImageDirectorSettings | null;
  }

  // Every field of `gen` is read fresh (via refreshAllSettings) right before sendMessage/
  // regenerate call this, instead of from this hook's own state — state updates triggered by
  // that refresh may not have re-rendered yet by the time this runs, and generation can take a
  // long time, during which the user could open Settings and change something again. Passing
  // everything explicitly means this generation always uses exactly what was current when it
  // started, never a stale mount-time value and never a value from a settings change made
  // mid-flight (which will correctly apply starting from the *next* generation instead).
  const runGeneration = useCallback(
    (targetChatId: string, targetMessageId: string, swipeIndex: number, context: ReturnType<typeof buildPrompt>, gen: GenerationContext) => {
      setIsStreaming(true);
      setStreamError(null);
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Accumulate the reply text synchronously here (rather than reading chatRef.current in
      // onDone) because for a non-streaming reply the single "token" + "done" SSE events arrive
      // in the same tick — chatRef.current would still hold the empty placeholder, so ComfyInject
      // would never see the [[IMG:...]] markers. Seed from the existing swipe so "Continuar"
      // (which appends to a non-empty swipe) keeps the full text.
      let accumulatedText =
        chatRef.current?.messages.find((m) => m.id === targetMessageId)?.swipes[swipeIndex] ?? "";
      const initialText = accumulatedText;
      let reasoning = "";

      streamChat(context, gen.samplingParams, {
        onReasoning: (content) => {
          reasoning += content;
        },
        onToken: (content) => {
          accumulatedText += content;
          setChat((prev) => (prev ? appendToActiveSwipe(prev, targetMessageId, content) : prev));
        },
        onDone: async () => {
          abortControllerRef.current = null;
          setIsStreaming(false);
          const current = chatRef.current;
          if (!current) return;
          const message = current.messages.find((m) => m.id === targetMessageId);
          if (!message) return;
          // Persist the settled text — chatRef.current is stale for non-streaming replies.
          const settledChat: Chat = {
            ...current,
            messages: current.messages.map((m) =>
              m.id === targetMessageId
                ? setSwipeReasoning(
                    { ...m, swipes: m.swipes.map((s, i) => (i === swipeIndex ? accumulatedText : s)) },
                    swipeIndex,
                    reasoning,
                  )
                : m,
            ),
          };
          scheduleSave(settledChat);
          // Reflect the settled text + reasoning in React state immediately (not just on disk),
          // so the "💭 Pensamiento del modelo" collapsible shows without a reload.
          setChat(settledChat);
          // For "Continuar", `initialText` is the pre-existing swipe content; only the appended
          // delta should be re-processed by Recast/ComfyInject/NPC Bank — never re-polish or
          // regenerate the old text (which was already settled).
          const delta = accumulatedText.slice(initialText.length);
          const initialMarkerCount = splitTextWithMarkers(initialText).filter((s) => s.type === "marker").length;
          const finalDelta = await processRecast(
            targetChatId,
            targetMessageId,
            swipeIndex,
            delta,
            gen.recastSettings,
            gen.recastPresets,
            initialText,
          );
          // Image Director auto-run: tag the freshly generated delta, then let ComfyInject
          // render those tags (runs BETWEEN Recast and image rendering).
          let renderDelta = finalDelta;
          if (gen.imageDirectorSettings?.enabled && gen.imageDirectorSettings.triggerMode === "auto") {
            setDirectorProcessing((prev) => new Set(prev).add(targetMessageId));
            setDirectorErrors((prev) => {
              const next = { ...prev };
              delete next[targetMessageId];
              return next;
            });
            setDirectorDiagnostics((prev) => {
              const next = { ...prev };
              delete next[targetMessageId];
              return next;
            });
            try {
              const tagged = await tagWithDirector(finalDelta, gen.imageDirectorSettings, targetMessageId);
              if (tagged !== finalDelta) {
                applyDirectorText(targetChatId, targetMessageId, swipeIndex, initialText + tagged);
                renderDelta = tagged;
              } else {
                setDirectorErrors((prev) => ({ ...prev, [targetMessageId]: t("chat.director.error.noImageInserted") }));
              }
            } catch (error) {
              const description = describeDirectorError(error);
              if (description) setDirectorErrors((prev) => ({ ...prev, [targetMessageId]: description }));
            } finally {
              setDirectorProcessing((prev) => {
                const next = new Set(prev);
                next.delete(targetMessageId);
                return next;
              });
            }
          }
          await processMessageImages(targetChatId, targetMessageId, swipeIndex, renderDelta, initialMarkerCount);
          // Memory chunks/summarizes once the message is fully settled (text + images).
          // NPC Tracker auto-scan (fixed interval) + heuristic auto-scan (zero-cost text gate).
          if (chatRef.current) {
            void runAutoScan(targetChatId, gen.npcTrackerSettings, targetMessageId);
            void runHeuristicScan(targetChatId, gen.npcTrackerSettings, renderDelta, targetMessageId);
            void runNpcEvolution(targetChatId, gen.npcTrackerSettings, targetMessageId);
            // Memoria Viva learns from the settled turn in the background: the reply is already
            // persisted, so a slow or failed extraction can never delay or break the conversation.
            void activeMemoryApi
              .extractActiveMemory(targetChatId)
              .then(() => setMemorySyncToken((token) => token + 1))
              .catch((error) => {
                console.warn("[Active memory] extraction failed:", error);
              });
            // Continuity Guard checks the finished reply against stored facts. Also background:
            // the text is already on disk, so neither a slow check nor a failed one can touch the
            // streaming flow or the save. Findings are surfaced per message in the UI.
            // An empty reply has nothing to check, and the endpoint rejects it outright.
            if (accumulatedText.trim()) {
              void activeMemoryApi
                .guardMemory(targetChatId, {
                  responseText: accumulatedText,
                  messageId: targetMessageId,
                  responderId: character?.name ?? undefined,
                })
                .then(({ report }) => {
                  setMemoryGuardFindings((prev) => {
                    // A regenerated reply that now checks out clears its own stale notice.
                    if (!report?.findings?.length) {
                      if (!(targetMessageId in prev)) return prev;
                      const next = { ...prev };
                      delete next[targetMessageId];
                      return next;
                    }
                    return { ...prev, [targetMessageId]: report };
                  });
                })
                .catch(() => {
                  // Silent by design: the guard is an aid, not part of the reply's success path.
                });
            }
          }
        },
        onError: (message) => {
          abortControllerRef.current = null;
          setStreamError(message);
          setIsStreaming(false);
          if (chatRef.current) scheduleSave(chatRef.current);
        },
      }, gen.model, gen.settings.streaming ?? true, controller.signal, targetChatId);
    },
    [scheduleSave, processRecast, processMessageImages, runAutoScan, runHeuristicScan, runNpcEvolution, tagWithDirector, applyDirectorText, character],
  );

  interface PreparedGeneration {
    context: ReturnType<typeof buildPrompt>;
    gen: GenerationContext;
  }

  // Shared context/macro assembly for every generation path (send / regenerate / continue /
  // impersonate). `chatForBuild` feeds the prompt + Roleplay Memory; `npcChat` feeds the NPC
  // Bank injection (relevance scoring + dossier gating read the settled scene, not the
  // not-yet-generated turn — the original code passed the *pre-edit* `chat` here).
  const prepareGeneration = useCallback(
    async (
      chatForBuild: Chat,
      npcChat: Chat,
      excludeIds: Set<string>,
      recentUserText: string,
    ): Promise<PreparedGeneration> => {
      const fresh = await refreshAllSettings();
      const addons = buildAddonsMacro(fresh.addonsSettings);
      const recentChatText = npcChat.messages
        .slice(-NPC_RECENCY_WINDOW)
        .map((m) => m.swipes[m.activeSwipeIndex])
        .join("\n");
      const mentionedNpcs = extractMentionedNpcs(recentUserText, npcChat.npcs ?? []);
      const npcTracker = buildNpcTrackerMacro(fresh.npcTrackerSettings, npcChat.npcs ?? [], recentChatText, mentionedNpcs);
      const comfyInject = buildComfyInjectMacro(fresh.comfyInjectSettings, character?.imageTags);
      const plumaText = buildPlumaMacro(fresh.plumaSettings);
      const promptChat = chatForBuild;
      // The active preset owns its prompt blocks; with none it contributes no blocks at all (the
      // global prompt list applies only while no preset is active). The context template still
      // falls back to the global one, since a missing template would drop the character-card
      // injection entirely rather than mean "no template".
      const effectiveSettings = {
        ...fresh.settings,
        promptBlocks: fresh.activePreset.promptBlocks ?? [],
        contextTemplate: fresh.activePreset.contextTemplate || fresh.settings.contextTemplate,
        contextTemplateEnabled: fresh.activePreset.contextTemplateEnabled ?? fresh.settings.contextTemplateEnabled,
        maxContextTokens: fresh.activePreset.maxContextTokens,
        squashSystemMessages: fresh.activePreset.squashSystemMessages,
        strictAlternation: fresh.activePreset.strictAlternation,
      };
      const lorebook = await lorebooksApi.scanLorebooks(promptChat, fresh.activePreset.maxContextTokens ?? 8000).catch((error) => {
        console.warn("[Lorebooks] scan failed; generation continues without lore:", error);
        return null;
      });
      // Memoria Viva: the compiled brief is what keeps a long chat coherent once the older messages
      // fall out of the context window. `persist` records the trace so the panel can show exactly
      // what this turn received. A failure here must never block a reply, so it degrades to "no
      // memory this turn" the same way lorebook scanning does.
      const memoryBrief = await activeMemoryApi
        .retrieveMemoryBrief(promptChat.id, {
          query: recentUserText,
          responderId: character?.name ?? undefined,
          persist: true,
          // The backend sizes the brief as a percentage of the real context window when it knows
          // how many tokens this turn gets; without it, the brief falls back to a flat budget.
          maxContextTokens: fresh.activePreset.maxContextTokens,
        })
        .catch((error) => {
          console.warn("[Active memory] brief failed; generation continues without memory:", error);
          return null;
        });
      const context = buildPrompt(
        promptChat,
        character,
        persona,
        effectiveSettings,
        excludeIds,
        {
          // Retired layers stay as empty macros so user blocks that still reference them resolve
          // to an empty string instead of leaking a literal `{{engine}}` into the prompt.
          memory: memoryBrief?.brief ?? "",
          engine: "",
          globalToggles: "",
          addons,
          npcTracker,
          comfyInject,
          pluma: plumaText,
        },
        fresh.comfyInjectSettings.directorMode === true && fresh.imageDirectorSettings?.enabled === true,
        lorebook,
      );
      return {
        context,
        gen: {
          settings: fresh.settings,
          samplingParams: fresh.samplingParams,
          model: fresh.activePreset.model || undefined,
          recastSettings: fresh.recastSettings,
          recastPresets: fresh.recastPresets,
          npcTrackerSettings: fresh.npcTrackerSettings,
          imageDirectorSettings: fresh.imageDirectorSettings,
        },
      };
    },
    [character, persona, refreshAllSettings],
  );

  // Background: after the first user message, tries the free OpenRouter models to give the chat
  // a nicer title. Falls back silently to the "first 40 chars" default the caller already set.
  const generateAndSetTitle = useCallback(
    async (targetChatId: string, characterName: string, firstUserText: string) => {
      try {
        const { title } = await providersApi.generateTitle(characterName, firstUserText);
        if (title && chatRef.current?.id === targetChatId) {
          setChat((prev) => {
            if (!prev) return prev;
            const next = { ...prev, title };
            scheduleSave(next);
            return next;
          });
        }
      } catch {
        // keep the fallback title
      }
    },
    [scheduleSave],
  );

  // "/img NombreNPC" chat command — Director writes ONE reaction-shot [[IMG:...]] for that NPC
  // reacting to the last message, inserted as its own image-only message (no narration).
  const triggerNpcReactionImage = useCallback(
    async (npcName: string) => {
      const current = chatRef.current;
      if (!current) return;
      const npc = findNpcByName(current.npcs ?? [], npcName);
      if (!npc) {
        setStreamError(t("chat.errors.npcNotFound", { name: npcName }));
        return;
      }
      const lastMessage = current.messages[current.messages.length - 1];
      const lastMessageText = lastMessage ? (lastMessage.swipes[lastMessage.activeSwipeIndex] ?? "") : "";
      setNpcReactionProcessing(true);
      try {
        const { marker } = await withTimeout(
          directorApi.runDirectorReaction({ name: npc.name, values: npc.values }, lastMessageText, current.id),
          60_000,
          t("chat.director.reactionLabel"),
        );
        const newMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          swipes: [marker],
          activeSwipeIndex: 0,
          createdAt: Date.now(),
        };
        const nextChat: Chat = { ...current, messages: [...current.messages, newMessage] };
        setChat(nextChat);
        scheduleSave(nextChat);
        await processMessageImages(current.id, newMessage.id, 0, marker, 0);
      } catch (error) {
        setStreamError(error instanceof Error ? error.message : t("chat.errors.reactionImageFailed"));
      } finally {
        setNpcReactionProcessing(false);
      }
    },
    [scheduleSave, processMessageImages],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!chat || isStreaming || !text.trim() || !settings) return;

      const imgCommand = text.trim().match(/^\/img\s+(.+)$/i);
      if (imgCommand) {
        await triggerNpcReactionImage(imgCommand[1].trim());
        return;
      }

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        swipes: [text],
        activeSwipeIndex: 0,
        createdAt: Date.now(),
        personaAvatar: persona?.avatar,
      };
      const assistantPlaceholder: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        swipes: [""],
        activeSwipeIndex: 0,
        createdAt: Date.now(),
      };

      // Auto-title from the FIRST USER message (not the first message overall — character
      // chats are seeded with first_mes, so `messages.length` is already > 0 on the first turn).
      const isFirstUserMessage = !chat.messages.some((m) => m.role === "user");
      const nextChat: Chat = {
        ...chat,
        title: isFirstUserMessage ? text.slice(0, 40) : chat.title,
        messages: [...chat.messages, userMessage, assistantPlaceholder],
      };
      setChat(nextChat);
      scheduleSave(nextChat);
      setIsStreaming(true); // block double-send while awaiting plugin hooks below

      if (isFirstUserMessage) {
        void generateAndSetTitle(nextChat.id, character?.name ?? "", text);
      }

      const { context, gen } = await prepareGeneration(
        nextChat,
        chat,
        new Set([assistantPlaceholder.id]),
        text,
      );
      runGeneration(nextChat.id, assistantPlaceholder.id, 0, context, gen);
    },
    [chat, isStreaming, settings, runGeneration, scheduleSave, prepareGeneration, triggerNpcReactionImage],
  );

  const regenerate = useCallback(async () => {
    if (!chat || isStreaming || !settings) return;
    const last = chat.messages[chat.messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const newSwipeIndex = last.swipes.length;

    const nextChat: Chat = {
      ...chat,
      messages: chat.messages.map((m) =>
        m.id === last.id ? { ...m, swipes: [...m.swipes, ""], activeSwipeIndex: newSwipeIndex } : m,
      ),
    };
    setChat(nextChat);
    setIsStreaming(true);

    const lastUserMessage = [...chat.messages].reverse().find((m) => m.role === "user");
    const { context, gen } = await prepareGeneration(
      nextChat,
      chat,
      new Set([last.id]),
      lastUserMessage?.swipes[lastUserMessage.activeSwipeIndex] ?? "",
    );
    runGeneration(nextChat.id, last.id, newSwipeIndex, context, gen);
  }, [chat, isStreaming, settings, runGeneration, prepareGeneration]);

  // "Continuar": keep appending to the last assistant message (same swipe) so the model keeps
  // writing from where it stopped. Unlike regenerate, the last message is NOT excluded from
  // context — the model sees its own partial reply and continues it.
  const continueLast = useCallback(async () => {
    if (!chat || isStreaming || !settings) return;
    const last = chat.messages[chat.messages.length - 1];
    if (!last || last.role !== "assistant" || !last.swipes[last.activeSwipeIndex].trim()) return;

    setIsStreaming(true);
    const lastUserMessage = [...chat.messages].reverse().find((m) => m.role === "user");
    const { context, gen } = await prepareGeneration(
      chat,
      chat,
      new Set(),
      lastUserMessage?.swipes[lastUserMessage.activeSwipeIndex] ?? "",
    );
    runGeneration(chat.id, last.id, last.activeSwipeIndex, context, gen);
  }, [chat, isStreaming, settings, runGeneration, prepareGeneration]);

  // "Impersonar": send the text AS the character (assistant role), then generate a continuation.
  const impersonate = useCallback(
    async (text: string) => {
      if (!chat || isStreaming || !text.trim() || !settings) return;

      const impersonation: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        swipes: [text],
        activeSwipeIndex: 0,
        createdAt: Date.now(),
      };
      const assistantPlaceholder: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        swipes: [""],
        activeSwipeIndex: 0,
        createdAt: Date.now(),
      };

      const nextChat: Chat = {
        ...chat,
        messages: [...chat.messages, impersonation, assistantPlaceholder],
      };
      setChat(nextChat);
      scheduleSave(nextChat);
      setIsStreaming(true);

      const { context, gen } = await prepareGeneration(
        nextChat,
        chat,
        new Set([assistantPlaceholder.id]),
        text,
      );
      runGeneration(nextChat.id, assistantPlaceholder.id, 0, context, gen);
    },
    [chat, isStreaming, settings, runGeneration, scheduleSave, prepareGeneration],
  );

  const editMessage = useCallback(
    (id: string, newText: string) => {
      if (!chat || isStreaming) return;
      const exists = chat.messages.some((m) => m.id === id);
      const nextChat: Chat = {
        ...chat,
        messages: chat.messages.map((m) => {
          if (m.id !== id) return m;
          const swipes = m.swipes.map((s, i) => (i === m.activeSwipeIndex ? newText : s));
          // Editing invalidates this swipe's resolved images — marker positions/content may differ now.
          const prefix = `${m.activeSwipeIndex}:`;
          const images = m.images
            ? Object.fromEntries(Object.entries(m.images).filter(([key]) => !key.startsWith(prefix)))
            : m.images;
          return { ...m, swipes, images };
        }),
      };
      setChat(nextChat);
      scheduleSave(nextChat);
      // The brief may quote the old wording, so memory that cited this message needs review.
      if (exists) invalidateMemory([id], t("chat.memory.invalidation.edited"));
    },
    [chat, isStreaming, scheduleSave, invalidateMemory],
  );

  const deleteMessage = useCallback(
    (id: string) => {
      if (!chat || isStreaming) return;
      const deletedIndex = chat.messages.findIndex((m) => m.id === id);
      if (deletedIndex === -1) return;
      const nextChat: Chat = {
        ...chat,
        messages: chat.messages.filter((m) => m.id !== id),
      };
      setChat(nextChat);
      scheduleSave(nextChat);
      // Facts/threads whose only evidence was this message can no longer be verified.
      invalidateMemory([id], t("chat.memory.invalidation.deleted"));
    },
    [chat, isStreaming, scheduleSave, invalidateMemory],
  );

  const swipe = useCallback(
    (id: string, direction: -1 | 1) => {
      if (!chat || isStreaming) return;
      const target = chat.messages.find((m) => m.id === id);
      if (!target) return;
      const nextIndex = Math.min(Math.max(target.activeSwipeIndex + direction, 0), target.swipes.length - 1);
      // Already at either end: nothing changed, so there is nothing to invalidate either.
      if (nextIndex === target.activeSwipeIndex) return;
      const nextChat: Chat = {
        ...chat,
        messages: chat.messages.map((m) => (m.id === id ? { ...m, activeSwipeIndex: nextIndex } : m)),
      };
      setChat(nextChat);
      scheduleSave(nextChat);
      // A different variant is now the live turn, so memory extracted from the previous one is
      // no longer evidence for what the model sees.
      invalidateMemory([id], t("chat.memory.invalidation.swipe"));
    },
    [chat, isStreaming, scheduleSave, invalidateMemory],
  );

  // Image Director: manual trigger — tag this message and render the new tags.
  const runDirector = useCallback(
    async (messageId: string) => {
      const chatNow = chatRef.current;
      if (!chatNow || isStreaming) return;
      const message = chatNow.messages.find((m) => m.id === messageId);
      if (!message) return;
      const swipeIndex = message.activeSwipeIndex;
      const text = message.swipes[swipeIndex];
      if (!text?.trim()) return;

      setDirectorProcessing((prev) => new Set(prev).add(messageId));
      setDirectorErrors((prev) => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
      setDirectorDiagnostics((prev) => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
      try {
        const tagged = await tagWithDirector(text, imageDirectorSettings, messageId);
        if (tagged !== text) {
          applyDirectorText(chatNow.id, messageId, swipeIndex, tagged);
          await processMessageImages(chatNow.id, messageId, swipeIndex, tagged, 0);
        } else {
          setDirectorErrors((prev) => ({ ...prev, [messageId]: t("chat.director.error.noImageInserted") }));
        }
      } catch (error) {
        const description = describeDirectorError(error);
        if (description) setDirectorErrors((prev) => ({ ...prev, [messageId]: description }));
      } finally {
        setDirectorProcessing((prev) => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
      }
    },
    [isStreaming, tagWithDirector, applyDirectorText, processMessageImages, imageDirectorSettings],
  );

  // Manual "Revisar estado" — audits/corrects the visual-state ledger against the last
  // message, WITHOUT touching or inserting any [[IMG:...]] tag. Separate from runDirector,
  // which does both tagging and state updates in one pass.
  const runVisualStateCheck = useCallback(async () => {
    const chatNow = chatRef.current;
    if (!chatNow || isStreaming) return;
    const lastMessage = [...chatNow.messages].reverse().find((m) => m.role === "assistant");
    if (!lastMessage) return;
    const text = lastMessage.swipes[lastMessage.activeSwipeIndex];
    if (!text?.trim()) return;

    setVisualStateCheckProcessing(true);
    setVisualStateCheckResult(null);
    try {
      const settings = imageDirectorSettings;
      const depth = settings?.contextDepth ?? 0;
      const context: {
        chatId?: string;
        character?: { name: string; description: string; personality: string; scenario: string; imageTags: string };
        npcs?: Array<{ name: string; values: Record<string, string> }>;
        persona?: { name: string; imageTags: string };
        recentMessages?: Array<{ role: string; content: string }>;
        visualState?: Record<string, CharacterVisualState>;
      } = { chatId: chatNow.id };
      if (character) {
        context.character = {
          name: character.name,
          description: character.description,
          personality: character.personality,
          scenario: character.scenario,
          imageTags: character.imageTags || "",
        };
      }
      if (settings?.includePersonaContext && persona?.values?.imageTags) {
        context.persona = { name: persona.name, imageTags: persona.values.imageTags };
      }
      if (chatNow.npcs?.length) {
        context.npcs = chatNow.npcs.map((npc) => ({ name: npc.name, values: npc.values }));
      }
      if (depth > 0) {
        context.recentMessages = chatNow.messages.slice(-depth).map((m) => ({ role: m.role, content: m.swipes[m.activeSwipeIndex] }));
      }
      context.visualState = chatNow.visualState ?? {};

      const { stateUpdates } = await directorApi.checkVisualState(text, context);
      if (stateUpdates?.length) {
        applyVisualStateUpdates(stateUpdates, lastMessage.id);
        setVisualStateCheckResult(t("chat.director.stateCheck.updated", { count: stateUpdates.length }));
      } else {
        setVisualStateCheckResult(t("chat.director.stateCheck.noChanges"));
      }
    } catch (error) {
      const description = describeDirectorError(error);
      setVisualStateCheckResult(description ?? t("chat.director.stateCheck.failed"));
    } finally {
      setVisualStateCheckProcessing(false);
    }
  }, [isStreaming, imageDirectorSettings, character, persona, applyVisualStateUpdates]);

  return {
    chat,
    character,
    refreshCharacter,
    persona,
    isLoading,
    isStreaming,
    stopGeneration,
    streamError,
    comfyInjectEnabled: comfyInjectSettings?.enabled ?? false,
    imagesGenerating,
    recastProcessing,
    recastModalKey,
    runRecastOnMessage,
    openRecastModal,
    closeRecastModal,
    acceptRecast,
    rejectRecast,
    sendMessage,
    regenerate,
    continueLast,
    impersonate,
    editMessage,
    deleteMessage,
    swipeLeft: (id: string) => swipe(id, -1),
    swipeRight: (id: string) => swipe(id, 1),
    retryMarker,
    generateMarker,
    npcTrackerSettings,
    updateNpcs,
    scanNpcs,
    evolveNpcsManually,
    setChatPersona,
    setChatLorebook,
    setChatVariables,
    runDirector,
    cancelDirector,
    directorProcessing,
    directorAvailable: !!imageDirectorSettings?.enabled && !!imageDirectorSettings.model?.trim(),
      directorErrors,
      directorDiagnostics,
    directorMinTagsPerImage: imageDirectorSettings?.minTagsPerImage ?? 0,
    updateVisualState,
    npcReactionProcessing,
    runVisualStateCheck,
    visualStateCheckProcessing,
    visualStateCheckResult,
    memoryGuardFindings,
    memorySyncToken,
    dismissGuard,
  };
}
