import { History, Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { ActiveMemoryState, MemoryRevision } from "../../types/activeMemory";
import { useT } from "../../i18n";
import { Alert, Badge, Button } from "../ui";
import { EmptySection } from "./memoryBits";
import { useMemoryAction } from "./memoryAction";
import { REVISION_SOURCE_LABELS, formatDate, shortId } from "./memoryFormat";

interface Props {
  memory: ActiveMemoryState;
  onRollback?: (revisionId?: string) => Promise<void>;
}

function RevisionRow({ revision, busy, confirming, onAsk, onCancel, onConfirm }: {
  revision: MemoryRevision;
  busy: boolean;
  confirming: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const date = formatDate(revision.createdAt);
  const t = useT();
  return (
    <article className="rounded-lg border border-border bg-bg p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={revision.source === "rollback" ? "neutral" : revision.source === "extraction" ? "accent" : "accent2"}>
              {t(REVISION_SOURCE_LABELS[revision.source])}
            </Badge>
            {date && <span className="text-xs text-text-faint">{date}</span>}
            <span className="font-mono text-[11px] text-text-faint" title={t("memory.revisions.revisionTitle", { id: revision.id })}>{shortId(revision.id)}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-text">{revision.summary || t("memory.revisions.noDescription")}</p>
        </div>
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">{t("memory.revisions.ask")}</span>
            <Button size="sm" variant="primary" disabled={busy} onClick={onConfirm}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              {t("memory.revisions.confirm")}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>{t("common.actions.cancel")}</Button>
          </div>
        ) : (
          <Button size="sm" variant="secondary" disabled={busy} onClick={onAsk}>
            <RotateCcw size={14} />
            {t("memory.revisions.restore")}
          </Button>
        )}
      </div>
    </article>
  );
}

export function RevisionsTab({ memory, onRollback }: Props) {
  const t = useT();
  const revisions = memory.revisions ?? [];
  const action = useMemoryAction(onRollback);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingLatest, setPendingLatest] = useState(false);

  async function restore(revisionId?: string) {
    const outcome = await action.run(revisionId);
    if (outcome.ok) {
      setPendingId(null);
      setPendingLatest(false);
    }
  }

  const latestButton = onRollback ? (
    pendingLatest ? (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-muted">{t("memory.revisions.confirmLatest")}</span>
        <Button size="sm" variant="primary" disabled={action.busy} onClick={() => void restore()}>
          {action.busy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
          {t("memory.revisions.confirm")}
        </Button>
        <Button size="sm" variant="ghost" disabled={action.busy} onClick={() => setPendingLatest(false)}>{t("common.actions.cancel")}</Button>
      </div>
    ) : (
      <Button size="sm" variant="secondary" onClick={() => { setPendingLatest(true); setPendingId(null); }}>
        <RotateCcw size={14} />
        {t("memory.revisions.restoreLatest")}
      </Button>
    )
  ) : null;

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-text-faint">
        {t("memory.revisions.intro")}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-text-faint">
          {t("memory.revisions.count", { count: revisions.length })}
        </span>
        {latestButton}
      </div>
      {!onRollback && (
        <Alert kind="info">
          {t("memory.revisions.notConnected")}
        </Alert>
      )}
      {action.error && <Alert kind="error">{action.error}</Alert>}
      {revisions.length === 0 ? (
        <EmptySection
          icon={History}
          title={t("memory.revisions.emptyTitle")}
          body={t("memory.revisions.emptyBody")}
        />
      ) : (
        <div className="space-y-3">
          {[...revisions].reverse().map((revision) => (
            <RevisionRow
              key={revision.id}
              revision={revision}
              busy={action.busy}
              confirming={pendingId === revision.id}
              onAsk={() => { setPendingId(revision.id); setPendingLatest(false); }}
              onCancel={() => setPendingId(null)}
              onConfirm={() => void restore(revision.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
