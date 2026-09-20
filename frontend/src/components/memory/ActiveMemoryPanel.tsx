import { Brain, Loader2, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import type { ActiveMemorySettingsPatch } from "../../types/activeMemory";
import { useT } from "../../i18n";
import type { TranslationKey } from "../../i18n";
import { Alert, Badge, Button, Tabs } from "../ui";
import { CanonTab } from "./CanonTab";
import { EpisodesTab } from "./EpisodesTab";
import { KnowledgeTab } from "./KnowledgeTab";
import { LoadingState, EmptySection } from "./memoryBits";
import { NowTab } from "./NowTab";
import { RevisionsTab } from "./RevisionsTab";
import { SettingsTab } from "./SettingsTab";
import { ThreadsTab } from "./ThreadsTab";
import { TimelineTab } from "./TimelineTab";
import { UsedTab } from "./UsedTab";
import { memoryIsEmpty } from "./memoryFormat";
import type { ActiveMemoryPanelProps, MemoryFactPatch, MemoryThreadPatch } from "./panelTypes";

export type { ActiveMemoryPanelProps } from "./panelTypes";
/** Alias so the component can be typed as `Props` from the outside. */
export type Props = ActiveMemoryPanelProps;

export type {
  MemoryExtractionOutcome,
  MemoryFactPatch,
  MemoryMergeTarget,
  MemoryThreadPatch,
} from "./panelTypes";

type TabId = "now" | "canon" | "threads" | "episodes" | "knowledge" | "timeline" | "revisions" | "settings" | "used";

interface TabSpec {
  id: TabId;
  labelKey: TranslationKey;
  count?: number;
}

export function ActiveMemoryPanel({
  memory,
  loading,
  error,
  savingIds,
  onRetry,
  onUpdateFact,
  onUpdateThread,
  onToggleEnabled,
  onUpdateSettings,
  onUpdateItem,
  onMerge,
  onRollback,
  onRunExtraction,
  onPreviewBrief,
  knownNames = [],
  onGoToMessage,
  lastExtractionReport,
}: ActiveMemoryPanelProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<TabId>("now");
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  // Every specific callback can be replaced by the generic `onUpdateItem`, so the host only has to
  // wire the generic one (or the hook's typed helpers) and the panel still works.
  const applyFactPatch = useMemo(() => {
    if (onUpdateFact) return onUpdateFact;
    if (!onUpdateItem) return undefined;
    return (id: string, patch: MemoryFactPatch) => onUpdateItem({ target: "fact", id, patch });
  }, [onUpdateFact, onUpdateItem]);

  const applyThreadPatch = useMemo(() => {
    if (onUpdateThread) return onUpdateThread;
    if (!onUpdateItem) return undefined;
    return (id: string, patch: MemoryThreadPatch) => onUpdateItem({ target: "thread", id, patch });
  }, [onUpdateThread, onUpdateItem]);

  const applySettings = useMemo(() => {
    if (onUpdateSettings) return onUpdateSettings;
    if (!onUpdateItem) return undefined;
    return (patch: ActiveMemorySettingsPatch) => onUpdateItem({ target: "settings", patch });
  }, [onUpdateSettings, onUpdateItem]);

  const toggleEnabled = onToggleEnabled
    ?? (applySettings ? (enabled: boolean) => applySettings({ enabled }) : undefined);

  const tabs = useMemo<TabSpec[]>(() => [
    { id: "now", labelKey: "memory.tabs.now" },
    { id: "canon", labelKey: "memory.tabs.canon", count: memory?.facts.length },
    { id: "threads", labelKey: "memory.tabs.threads", count: memory?.threads.length },
    { id: "episodes", labelKey: "memory.tabs.episodes", count: memory?.episodes?.length },
    { id: "knowledge", labelKey: "memory.tabs.knowledge" },
    { id: "timeline", labelKey: "memory.tabs.timeline" },
    { id: "revisions", labelKey: "memory.tabs.revisions", count: memory?.revisions?.length },
    { id: "settings", labelKey: "memory.tabs.settings" },
    { id: "used", labelKey: "memory.tabs.used" },
  ], [memory]);

  async function handleToggle(next: boolean) {
    if (!toggleEnabled) return;
    setToggleError(null);
    setToggling(true);
    try {
      await toggleEnabled(next);
    } catch (failure) {
      setToggleError(failure instanceof Error ? failure.message : t("memory.panel.toggleFailed"));
    } finally {
      setToggling(false);
    }
  }

  if (loading && !memory) return <LoadingState />;

  if (error && !memory) {
    return (
      <div className="space-y-4">
        <Alert kind="error">{error}</Alert>
        <Button onClick={onRetry} disabled={loading}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          {t("memory.panel.retry")}
        </Button>
      </div>
    );
  }

  if (!memory) {
    return (
      <EmptySection
        icon={Brain}
        title={t("memory.panel.emptyTitle")}
        body={t("memory.panel.emptyBody")}
        action={<Button onClick={onRetry} disabled={loading}><RefreshCw size={15} />{t("memory.panel.retry")}</Button>}
      />
    );
  }

  const enabled = memory.settings.enabled;
  const empty = memoryIsEmpty(memory);

  return (
    <div>
      {/* Experimental, stated plainly: the extractor is imperfect and can store things that are
          wrong. Saying so up front is cheaper than letting a bad fact pass as canon. */}
      <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent2">{t("memory.panel.experimental")}</Badge>
          <span className="text-sm font-medium text-text">{t("memory.panel.mayFail")}</span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
          {t("memory.panel.warningLead")} <strong className="text-text">{t("memory.tabs.canon")}</strong> {t("memory.panel.warningBetween")}{" "}
          <strong className="text-text">{t("memory.tabs.threads")}</strong>{t("memory.panel.warningTail")}{" "}
          <strong className="text-text">{t("memory.tabs.revisions")}</strong> {t("memory.panel.warningEnd")}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-bg px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text">
            {enabled ? t("memory.shared.memoryEnabled") : t("memory.shared.memoryDisabled")}
          </p>
          <p className="mt-0.5 text-xs text-text-faint">
            {enabled
              ? t("memory.panel.enabledHint")
              : t("memory.panel.disabledHint")}
          </p>
        </div>
        {toggleEnabled && (
          <Button variant={enabled ? "ghost" : "primary"} size="sm" disabled={toggling} onClick={() => void handleToggle(!enabled)}>
            {toggling ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
            {enabled ? t("memory.panel.disable") : t("memory.panel.enable")}
          </Button>
        )}
      </div>
      {toggleError && <div className="mb-4"><Alert kind="error">{toggleError}</Alert></div>}

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      {empty && (
        <div className="mb-4">
          <Alert kind="info">
            {t("memory.panel.emptyAlert")}
          </Alert>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs text-text-faint">
          {t("memory.panel.version", { version: memory.version })}
          {memory.lastProcessedMessageId
            ? <> · {t("memory.panel.processedUpTo", { id: memory.lastProcessedMessageId.slice(0, 8) })}</>
            : null}
          {memory.lastBrief
            ? <> · {t("memory.panel.briefItems", { count: memory.lastBrief.selected?.length ?? 0 })}</>
            : null}
        </p>
        <Button variant="ghost" size="sm" onClick={onRetry} disabled={loading} title={t("memory.panel.refreshTitle")}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {t("memory.panel.refresh")}
        </Button>
      </div>

      <Tabs
        tabs={tabs.map((tab) => ({ id: tab.id, label: tab.count ? `${t(tab.labelKey)} (${tab.count})` : t(tab.labelKey) }))}
        active={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
      />

      <div className="mt-4">
        {activeTab === "now" && <NowTab scene={memory.scene} onGoToMessage={onGoToMessage} />}
        {activeTab === "canon" && (
          <CanonTab
            memory={memory}
            savingIds={savingIds}
            knownNames={knownNames}
            onUpdateFact={applyFactPatch}
            onMerge={onMerge}
            onGoToMessage={onGoToMessage}
          />
        )}
        {activeTab === "threads" && (
          <ThreadsTab
            memory={memory}
            savingIds={savingIds}
            onUpdateThread={applyThreadPatch}
            onGoToMessage={onGoToMessage}
          />
        )}
        {activeTab === "episodes" && <EpisodesTab memory={memory} onGoToMessage={onGoToMessage} />}
        {activeTab === "knowledge" && (
          <KnowledgeTab
            memory={memory}
            knownNames={knownNames}
            savingIds={savingIds}
            onUpdateFact={applyFactPatch}
          />
        )}
        {activeTab === "timeline" && <TimelineTab memory={memory} onGoToMessage={onGoToMessage} />}
        {activeTab === "revisions" && <RevisionsTab memory={memory} onRollback={onRollback} />}
        {activeTab === "settings" && (
          <SettingsTab
            settings={memory.settings}
            saving={savingIds.has("settings")}
            knownNames={knownNames}
            onUpdateSettings={applySettings}
            onRunExtraction={onRunExtraction}
            onPreviewBrief={onPreviewBrief}
            lastExtractionReport={lastExtractionReport}
          />
        )}
        {activeTab === "used" && <UsedTab memory={memory} onGoToMessage={onGoToMessage} />}
      </div>
    </div>
  );
}
