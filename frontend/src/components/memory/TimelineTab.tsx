import { CalendarClock } from "lucide-react";
import type { ActiveMemoryState } from "../../types/activeMemory";
import { useT } from "../../i18n";
import type { TFunction, TranslationKey } from "../../i18n";
import { Badge } from "../ui";
import { EmptySection, JumpToMessage } from "./memoryBits";
import {
  FACT_STATUS_LABELS,
  THREAD_KIND_LABELS,
  THREAD_STATUS_LABELS,
  episodeTimestamp,
  factSentence,
  formatDate,
  percent,
  timestampOf,
} from "./memoryFormat";

interface Props {
  memory: ActiveMemoryState;
  onGoToMessage?: (messageId: string) => void;
}

type EntryKind = "episode" | "fact" | "thread";

interface TimelineEntry {
  id: string;
  kind: EntryKind;
  label: string;
  timestamp: number | null;
  date: string | null;
  title: string;
  detail?: string;
  messageId?: string;
}

const KIND_LABELS: Record<EntryKind, TranslationKey> = {
  episode: "memory.timeline.kind.episode",
  fact: "memory.timeline.kind.fact",
  thread: "memory.timeline.kind.thread",
};

const KIND_TONES: Record<EntryKind, "accent" | "accent2" | "neutral"> = {
  episode: "accent2",
  fact: "accent",
  thread: "neutral",
};

function buildEntries(memory: ActiveMemoryState, t: TFunction): TimelineEntry[] {
  const episodes: TimelineEntry[] = (memory.episodes ?? []).map((episode) => ({
    id: episode.id,
    kind: "episode",
    label: t(KIND_LABELS.episode),
    timestamp: episodeTimestamp(episode),
    date: formatDate(episode.occurredAt ?? episode.createdAt),
    title: episode.summary,
    detail: [episode.outcome && `${t("memory.shared.outcome")} ${episode.outcome}`, episode.location].filter(Boolean).join(" · ") || undefined,
    messageId: episode.sourceMessageIds[0],
  }));

  const facts: TimelineEntry[] = memory.facts.map((fact) => ({
    id: fact.id,
    kind: "fact",
    label: t(KIND_LABELS.fact),
    // Facts are ordered by when they were learned; `validFromMessageId` is an id, not a time, and
    // it is offered as the "ver mensaje" target instead.
    timestamp: timestampOf(fact.createdAt),
    date: formatDate(fact.createdAt),
    title: factSentence(fact),
    detail: `${t(FACT_STATUS_LABELS[fact.status])} · ${t("memory.shared.confidence", { percent: percent(fact.confidence) })}`,
    messageId: fact.validFromMessageId || fact.evidenceMessageIds[0],
  }));

  const threads: TimelineEntry[] = memory.threads.map((thread) => ({
    id: thread.id,
    kind: "thread",
    label: t(KIND_LABELS.thread),
    timestamp: timestampOf(thread.lastMentionedAt),
    date: formatDate(thread.lastMentionedAt),
    title: thread.title,
    detail: `${t(THREAD_KIND_LABELS[thread.kind])} · ${t(THREAD_STATUS_LABELS[thread.status])}`,
    messageId: thread.evidenceMessageIds[0],
  }));

  const entries = [...episodes, ...facts, ...threads];
  entries.sort((a, b) => {
    if (a.timestamp === null && b.timestamp === null) return 0;
    if (a.timestamp === null) return 1;
    if (b.timestamp === null) return -1;
    return b.timestamp - a.timestamp;
  });
  return entries;
}

export function TimelineTab({ memory, onGoToMessage }: Props) {
  const t = useT();
  // Built on every render rather than memoized: the entries carry translated labels and formatted
  // dates, so a language change has to rebuild them too.
  const entries = buildEntries(memory, t);

  if (entries.length === 0) {
    return (
      <EmptySection
        icon={CalendarClock}
        title={t("memory.timeline.emptyTitle")}
        body={t("memory.timeline.emptyBody")}
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-faint">
        {t("memory.timeline.count", { count: entries.length })}{t("memory.timeline.countSuffix")}
      </p>
      <ol className="ml-2 space-y-3 border-l border-border pl-4">
        {entries.map((entry) => (
          <li key={`${entry.kind}:${entry.id}`} className="relative">
            <span aria-hidden="true" className="absolute -left-[21px] top-3 h-2 w-2 rounded-full bg-accent" />
            <article className="rounded-lg border border-border bg-bg p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={KIND_TONES[entry.kind]}>{entry.label}</Badge>
                {entry.date && <span className="text-xs text-text-faint">{entry.date}</span>}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-text">{entry.title}</p>
              {entry.detail && <p className="mt-1 text-xs text-text-muted">{entry.detail}</p>}
              <JumpToMessage messageId={entry.messageId} onGoToMessage={onGoToMessage} className="mt-2" />
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}
