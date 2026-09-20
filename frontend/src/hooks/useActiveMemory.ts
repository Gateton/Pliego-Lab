import { useCallback, useEffect, useRef, useState } from "react";
import * as activeMemoryApi from "../api/activeMemory";
import { t } from "../i18n";
import type {
  ActiveMemoryPatch,
  ActiveMemorySettingsPatch,
  ActiveMemoryState,
  MemoryBriefPreview,
  MemoryExtractionMode,
  MemoryExtractionReport,
} from "../types/activeMemory";

/** Fields the panel may edit on a fact. Derived from the contract so it can never drift. */
export type MemoryFactPatch = Extract<ActiveMemoryPatch, { target: "fact" }>["patch"];

/** Fields the panel may edit on a thread. */
export type MemoryThreadPatch = Extract<ActiveMemoryPatch, { target: "thread" }>["patch"];

/** Merge targets, derived from the API helper so it stays in sync with the contract. */
export type MemoryMergeTarget = Parameters<typeof activeMemoryApi.mergeMemoryItems>[1]["target"];

/**
 * What a manual extraction actually did. `report` is null when the backend skipped the run, and
 * `skipped` then explains why ("disabled", "no-new-messages").
 */
export interface MemoryExtractionOutcome {
  report: MemoryExtractionReport | null;
  skipped?: string;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return t("memory.hook.connectFailed");
}

export function useActiveMemory(chatId: string | null) {
  const [memory, setMemory] = useState<ActiveMemoryState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  // The report is tagged with the chat it belongs to so switching chats cannot show a stale one
  // without needing an extra effect (state reset in effects triggers cascading renders).
  const [extraction, setExtraction] = useState<{ chatId: string | null; report: MemoryExtractionReport | null } | null>(null);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestRef.current;
    if (!chatId) {
      setMemory(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const next = await activeMemoryApi.getActiveMemory(chatId, controller.signal);
      if (requestRef.current === requestId) setMemory(next);
    } catch (nextError) {
      if (controller.signal.aborted || requestRef.current !== requestId) return;
      setError(describeError(nextError));
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    const requestId = ++requestRef.current;
    if (!chatId) {
      setMemory(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setMemory(null);
    setError(null);
    setLoading(true);
    void activeMemoryApi.getActiveMemory(chatId, controller.signal).then(
      (next) => {
        if (requestRef.current === requestId) setMemory(next);
      },
      (nextError: unknown) => {
        if (!controller.signal.aborted && requestRef.current === requestId) setError(describeError(nextError));
      },
    ).finally(() => {
      if (requestRef.current === requestId) setLoading(false);
    });

    return () => controller.abort();
  }, [chatId]);

  const startSaving = useCallback((key: string) => {
    setSavingIds((current) => new Set(current).add(key));
  }, []);

  const stopSaving = useCallback((key: string) => {
    setSavingIds((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }, []);

  const mutate = useCallback(async (
    key: string,
    mutation: Parameters<typeof activeMemoryApi.patchActiveMemory>[1],
  ) => {
    if (!chatId) return;
    startSaving(key);
    setError(null);
    try {
      setMemory(await activeMemoryApi.patchActiveMemory(chatId, mutation));
    } catch (nextError) {
      setError(describeError(nextError));
      throw nextError;
    } finally {
      stopSaving(key);
    }
  }, [chatId, startSaving, stopSaving]);

  /** Generic escape hatch: any `ActiveMemoryPatch` (fact, thread or settings) in one call. */
  const updateItem = useCallback((patch: ActiveMemoryPatch) => {
    const key = patch.target === "settings" ? "settings" : `${patch.target}:${patch.id}`;
    return mutate(key, patch);
  }, [mutate]);

  const updateFact = useCallback((id: string, patch: MemoryFactPatch) => (
    mutate(`fact:${id}`, { target: "fact", id, patch })
  ), [mutate]);

  const updateThread = useCallback((id: string, patch: MemoryThreadPatch) => (
    mutate(`thread:${id}`, { target: "thread", id, patch })
  ), [mutate]);

  /** Persists any subset of the settings (including `semantic` and `scope`) for this chat only. */
  const updateSettings = useCallback((patch: ActiveMemorySettingsPatch) => (
    mutate("settings", { target: "settings", patch })
  ), [mutate]);

  /** Folds a duplicate into the item that should survive. */
  const merge = useCallback(async (target: MemoryMergeTarget, keepId: string, mergeId: string) => {
    if (!chatId) return;
    const key = `merge:${target}:${keepId}`;
    startSaving(key);
    setError(null);
    try {
      setMemory(await activeMemoryApi.mergeMemoryItems(chatId, { target, keepId, mergeId }));
    } catch (nextError) {
      setError(describeError(nextError));
      throw nextError;
    } finally {
      stopSaving(key);
    }
  }, [chatId, startSaving, stopSaving]);

  /** Restores the newest revision, or the given one. */
  const rollback = useCallback(async (revisionId?: string) => {
    if (!chatId) return;
    startSaving("rollback");
    setError(null);
    try {
      setMemory(await activeMemoryApi.rollbackActiveMemory(chatId, revisionId));
    } catch (nextError) {
      setError(describeError(nextError));
      throw nextError;
    } finally {
      stopSaving("rollback");
    }
  }, [chatId, startSaving, stopSaving]);

  /**
   * Runs extraction now instead of waiting for the next turn. `options.all` reprocesses the whole
   * history instead of only the messages added since the last run.
   */
  const runExtraction = useCallback(async (
    mode?: MemoryExtractionMode,
    options: { all?: boolean } = {},
  ): Promise<MemoryExtractionOutcome> => {
    if (!chatId) throw new Error(t("memory.hook.noChatToExtract"));
    startSaving("extract");
    setError(null);
    try {
      const result = await activeMemoryApi.extractActiveMemory(chatId, { mode, all: options.all });
      setMemory(result.memory);
      const outcome: MemoryExtractionOutcome = { report: result.report ?? null, skipped: result.skipped };
      setExtraction({ chatId, report: outcome.report });
      return outcome;
    } catch (nextError) {
      setError(describeError(nextError));
      throw nextError;
    } finally {
      stopSaving("extract");
    }
  }, [chatId, startSaving, stopSaving]);

  /**
   * Compiles what the model *would* receive. Never persists, so previewing cannot rewrite the
   * trace of the real turn.
   */
  const previewBrief = useCallback((query: string, responderId?: string): Promise<MemoryBriefPreview> => {
    if (!chatId) return Promise.reject(new Error(t("memory.hook.noChatToPreview")));
    return activeMemoryApi.retrieveMemoryBrief(chatId, { query, responderId, persist: false });
  }, [chatId]);

  const lastExtractionReport = extraction && chatId && extraction.chatId === chatId ? extraction.report : null;

  return {
    memory,
    loading,
    error,
    savingIds,
    refresh,
    updateItem,
    updateFact,
    updateThread,
    updateSettings,
    merge,
    rollback,
    runExtraction,
    previewBrief,
    lastExtractionReport,
  };
}
