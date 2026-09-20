import { ListTodo, Loader2, Pin } from "lucide-react";
import type { ActiveMemoryState, MemoryThread, MemoryThreadStatus } from "../../types/activeMemory";
import { useT } from "../../i18n";
import { inputClasses } from "../ui";
import { EmptySection, EvidenceList, NeedsReviewBadge, ThreadStatusBadge } from "./memoryBits";
import { useMemoryAction } from "./memoryAction";
import { THREAD_KIND_LABELS, THREAD_STATUS_LABELS, formatDate, percent, threadNeedsReview } from "./memoryFormat";
import type { MemoryThreadPatch } from "./panelTypes";

interface Props {
  memory: ActiveMemoryState;
  savingIds: Set<string>;
  onUpdateThread?: (id: string, patch: MemoryThreadPatch) => Promise<void>;
  onGoToMessage?: (messageId: string) => void;
}

function ThreadRow({ thread, saving, onUpdate, onGoToMessage }: {
  thread: MemoryThread;
  saving: boolean;
  onUpdate?: (id: string, patch: MemoryThreadPatch) => Promise<void>;
  onGoToMessage?: (messageId: string) => void;
}) {
  const action = useMemoryAction(onUpdate);
  const t = useT();
  const busy = saving || action.busy;
  const lastMentioned = formatDate(thread.lastMentionedAt);
  const needsReview = threadNeedsReview(thread);

  return (
    <article className={`rounded-lg border bg-bg p-4 ${needsReview ? "border-warning/50" : "border-border"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-accent-2">{t(THREAD_KIND_LABELS[thread.kind])}</span>
            <ThreadStatusBadge status={thread.status} />
            {needsReview && <NeedsReviewBadge />}
          </div>
          <h3 className="mt-1 text-sm font-semibold text-text">{thread.title}</h3>
          {thread.resolutionCondition && (
            <p className="mt-1 text-xs leading-relaxed text-text-muted">{t("memory.threads.closesWhen", { condition: thread.resolutionCondition })}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void action.run(thread.id, { pinned: !thread.pinned })}
            disabled={busy}
            aria-pressed={Boolean(thread.pinned)}
            aria-label={thread.pinned ? t("memory.threads.unpin") : t("memory.threads.pin")}
            title={thread.pinned ? t("memory.threads.unpin") : t("memory.threads.pin")}
            className={`rounded-md border p-2 transition-colors disabled:cursor-wait disabled:opacity-50 ${
              thread.pinned ? "border-accent/50 bg-accent/15 text-accent" : "border-border text-text-muted hover:bg-bg-elevated-2 hover:text-text"
            }`}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Pin size={15} className={thread.pinned ? "fill-current" : ""} />}
          </button>
          <label className="flex items-center gap-2 text-xs font-semibold text-text-muted">
            <span>{t("memory.shared.status")}</span>
            <select
              value={thread.status}
              disabled={busy}
              onChange={(event) => void action.run(thread.id, { status: event.target.value as MemoryThreadStatus })}
              aria-label={t("memory.threads.statusOf", { title: thread.title })}
              className={`${inputClasses} w-auto py-1 text-xs`}
            >
              {Object.entries(THREAD_STATUS_LABELS).map(([value, labelKey]) => <option key={value} value={value}>{t(labelKey)}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-faint">
        <span>{t("memory.shared.priority", { percent: percent(thread.priority) })}</span>
        {thread.participantIds.length > 0 && <span>{t("memory.shared.participants", { names: thread.participantIds.join(", ") })}</span>}
        {lastMentioned && <span>{t("memory.threads.lastMentioned", { date: lastMentioned })}</span>}
      </div>
      <EvidenceList ids={thread.evidenceMessageIds} onGoToMessage={onGoToMessage} className="mt-3" />
      {action.error && <p className="mt-2 text-xs text-danger">{action.error}</p>}
    </article>
  );
}

export function ThreadsTab({ memory, savingIds, onUpdateThread, onGoToMessage }: Props) {
  const t = useT();
  if (memory.threads.length === 0) {
    return (
      <EmptySection
        icon={ListTodo}
        title={t("memory.threads.emptyTitle")}
        body={t("memory.threads.emptyBody")}
      />
    );
  }
  return (
    <div className="space-y-3">
      {memory.threads.map((thread) => (
        <ThreadRow
          key={thread.id}
          thread={thread}
          saving={savingIds.has(`thread:${thread.id}`)}
          onUpdate={onUpdateThread}
          onGoToMessage={onGoToMessage}
        />
      ))}
    </div>
  );
}
