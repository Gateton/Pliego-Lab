import { History } from "lucide-react";
import type { ActiveMemoryState } from "../../types/activeMemory";
import { useT } from "../../i18n";
import { EmptySection, EvidenceList } from "./memoryBits";
import { formatDate, percent } from "./memoryFormat";

interface Props {
  memory: ActiveMemoryState;
  onGoToMessage?: (messageId: string) => void;
}

export function EpisodesTab({ memory, onGoToMessage }: Props) {
  const t = useT();
  if (!memory.episodes?.length) {
    return (
      <EmptySection
        icon={History}
        title={t("memory.episodes.emptyTitle")}
        body={t("memory.episodes.emptyBody")}
      />
    );
  }

  return (
    <div className="space-y-3">
      {memory.episodes.map((episode) => {
        const when = formatDate(episode.occurredAt ?? episode.createdAt);
        return (
          <article key={episode.id} className="rounded-lg border border-border bg-bg p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 flex-1 text-sm leading-relaxed text-text">{episode.summary}</p>
              {episode.pinned && <span className="text-xs font-semibold text-accent-2">{t("memory.shared.pinned")}</span>}
            </div>
            {episode.outcome && (
              <p className="mt-2 text-sm text-text-muted"><strong className="text-text">{t("memory.shared.outcome")}</strong> {episode.outcome}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-faint">
              {episode.location && <span>{episode.location}</span>}
              {episode.participantIds.length > 0 && <span>{t("memory.shared.participants", { names: episode.participantIds.join(", ") })}</span>}
              {when && <span>{when}</span>}
              {episode.emotionalWeight !== undefined && <span>{t("memory.episodes.emotionalWeight", { percent: percent(episode.emotionalWeight) })}</span>}
            </div>
            <EvidenceList ids={episode.sourceMessageIds} onGoToMessage={onGoToMessage} className="mt-3" />
          </article>
        );
      })}
    </div>
  );
}
