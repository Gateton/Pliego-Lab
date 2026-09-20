import type {
  ActiveMemoryState,
  MemoryBriefSelection,
  MemoryEpisode,
  MemoryFact,
  MemoryItemType,
  MemoryThread,
} from "./types.js";

const STOP_WORDS = new Set([
  "para", "como", "pero", "porque", "esta", "este", "esto", "desde", "hasta", "sobre", "entre", "with", "from", "that", "this", "what", "when", "where", "have", "will", "your",
]);

export interface RetrieveMemoryOptions {
  query?: string;
  responderId?: string;
  entityIds?: string[];
  maxItems?: number;
}

export interface RetrievedMemoryItem extends MemoryBriefSelection {
  item: MemoryFact | MemoryThread | MemoryEpisode;
}

export interface MemoryRetrievalResult {
  items: RetrievedMemoryItem[];
  omittedCount: number;
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

function terms(value: string): Set<string> {
  return new Set(
    normalize(value)
      .split(/[^\p{L}\p{N}_-]+/u)
      .filter((term) => term.length >= 3 && !STOP_WORDS.has(term)),
  );
}

function overlapCount(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const value of left) if (right.has(value)) count += 1;
  return count;
}

function participants(type: MemoryItemType, item: MemoryFact | MemoryThread | MemoryEpisode): string[] {
  if (type === "fact") return [(item as MemoryFact).subject];
  return (item as MemoryThread | MemoryEpisode).participantIds;
}

/**
 * Identifiers the item can be anchored to. Facts carry `entityIds` resolved at extraction time
 * (NPC/character ids); threads and episodes only carry participant ids, which double as entities.
 */
function entityIdsOf(type: MemoryItemType, item: MemoryFact | MemoryThread | MemoryEpisode): string[] {
  if (type === "fact") return (item as MemoryFact).entityIds ?? [];
  return (item as MemoryThread | MemoryEpisode).participantIds ?? [];
}

/** Message ids an item cites as its source, whichever field the type uses. */
function evidenceIdsOf(type: MemoryItemType, item: MemoryFact | MemoryThread | MemoryEpisode): string[] {
  if (type === "episode") return (item as MemoryEpisode).sourceMessageIds;
  return (type === "fact" ? (item as MemoryFact).evidenceMessageIds : (item as MemoryThread).evidenceMessageIds) ?? [];
}

function itemText(type: MemoryItemType, item: MemoryFact | MemoryThread | MemoryEpisode): string {
  if (type === "fact") {
    const fact = item as MemoryFact;
    return `${fact.subject} ${fact.predicate} ${fact.object}`;
  }
  if (type === "thread") return (item as MemoryThread).title;
  const episode = item as MemoryEpisode;
  return `${episode.summary} ${episode.location ?? ""} ${episode.outcome ?? ""}`;
}

function itemTimestamp(type: MemoryItemType, item: MemoryFact | MemoryThread | MemoryEpisode): number {
  if (type === "fact") return (item as MemoryFact).updatedAt;
  if (type === "thread") return (item as MemoryThread).lastMentionedAt;
  return (item as MemoryEpisode).createdAt;
}

function isPinned(item: MemoryFact | MemoryThread | MemoryEpisode): boolean {
  return item.pinned === true;
}

function visible(fact: MemoryFact, responderId: string | undefined): boolean {
  if (!responderId || fact.visibleTo === "all") return true;
  return fact.visibleTo.includes(responderId);
}

export function retrieveActiveMemory(state: ActiveMemoryState, options: RetrieveMemoryOptions = {}): MemoryRetrievalResult {
  const queryTerms = terms(options.query ?? "");
  const explicitEntities = new Set((options.entityIds ?? []).map(normalize));
  const presentEntities = new Set(state.scene.presentCharacterIds.map(normalize));
  const source: Array<{ type: MemoryItemType; item: MemoryFact | MemoryThread | MemoryEpisode }> = [
    ...state.facts
      .filter((fact) => fact.status !== "invalidated" && !fact.validUntilMessageId && visible(fact, options.responderId))
      .map((item) => ({ type: "fact" as const, item })),
    ...state.threads.map((item) => ({ type: "thread" as const, item })),
    ...state.episodes.map((item) => ({ type: "episode" as const, item })),
  ];
  const byRecency = [...source].sort(
    (a, b) => itemTimestamp(b.type, b.item) - itemTimestamp(a.type, a.item) || a.item.id.localeCompare(b.item.id),
  );
  const recencyRank = new Map(byRecency.map((entry, index) => [`${entry.type}:${entry.item.id}`, index]));

  const ranked: RetrievedMemoryItem[] = source.map(({ type, item }) => {
    const reasons: string[] = [];
    let score = 0;
    const textTerms = terms(itemText(type, item));
    const participantSet = new Set(participants(type, item).map(normalize));
    const itemEntities = new Set(entityIdsOf(type, item).map(normalize));
    const entityMatches =
      overlapCount(queryTerms, textTerms) +
      overlapCount(explicitEntities, participantSet) +
      overlapCount(explicitEntities, itemEntities);
    if (entityMatches > 0) {
      score += Math.min(entityMatches, 3) * 4;
      reasons.push("entity match");
    }
    if ([...participantSet].some((participant) => presentEntities.has(participant))) {
      score += 3;
      reasons.push("present character");
    }
    // `causalLink * 3` from the design: an item anchored to the entities on stage is part of the
    // causal chain the current turn sits on. It is a different signal from "present character"
    // (which reads prose names), so both can fire on the same item.
    if ([...itemEntities].some((entity) => presentEntities.has(entity))) {
      score += 3;
      reasons.push("causal link");
    }
    if (type === "thread") {
      const thread = item as MemoryThread;
      const normalizedPriority = thread.priority > 1 ? Math.min(thread.priority / 5, 1) : Math.max(thread.priority, 0);
      if (thread.status === "open" || thread.status === "snoozed") {
        score += normalizedPriority * 3;
        reasons.push("open thread priority");
      } else {
        score -= 8;
        reasons.push("resolved penalty");
      }
    }
    if (isPinned(item)) {
      score += 6;
      reasons.push("manual pin");
    }
    const rank = recencyRank.get(`${type}:${item.id}`) ?? source.length;
    score += (1 / (rank + 1)) * 1.5;
    reasons.push("recency");
    const importance = type === "fact"
      ? (item as MemoryFact).importance
      : type === "episode"
        ? (item as MemoryEpisode).emotionalWeight ?? 0.5
        : Math.min((item as MemoryThread).priority, 1);
    score += Math.max(0, Math.min(importance, 1)) * 2;
    reasons.push("importance");
    return { type, id: item.id, item, score: Number(score.toFixed(4)), reasons };
  });

  ranked.sort((a, b) => b.score - a.score || a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
  const maxItems = Math.max(0, Math.min(options.maxItems ?? state.settings.maxBriefItems, 100));
  const selected: RetrievedMemoryItem[] = [];
  const picked = new Set<string>();
  // Evidence ids already in the brief. An item that cites one of them is part of the same causal
  // chain as something the model is already being told, so it earns the same +3 as the scene rule.
  const selectedEvidence = new Set<string>();
  const categoryCounts: Record<MemoryItemType, number> = { fact: 0, thread: 0, episode: 0 };
  const categoryLimits: Record<MemoryItemType, number> = {
    fact: state.settings.maxFacts,
    thread: state.settings.maxThreads,
    episode: state.settings.maxEpisodes,
  };
  for (;;) {
    if (selected.length >= maxItems) break;
    let bestIndex = -1;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < ranked.length; index += 1) {
      const candidate = ranked[index];
      if (picked.has(`${candidate.type}:${candidate.id}`)) continue;
      if (categoryCounts[candidate.type] >= categoryLimits[candidate.type]) continue;
      const causallyLinked = evidenceIdsOf(candidate.type, candidate.item).some((id) => selectedEvidence.has(id));
      const effective = candidate.score + (causallyLinked ? 3 : 0);
      // Strictly greater keeps the deterministic order of `ranked` for ties.
      if (effective > bestScore) {
        bestScore = effective;
        bestIndex = index;
      }
    }
    if (bestIndex < 0) break;
    const chosen = ranked[bestIndex];
    picked.add(`${chosen.type}:${chosen.id}`);
    if (bestScore !== chosen.score) {
      chosen.score = Number(bestScore.toFixed(4));
      if (!chosen.reasons.includes("causal link")) chosen.reasons.push("causal link");
    }
    selected.push(chosen);
    categoryCounts[chosen.type] += 1;
    for (const id of evidenceIdsOf(chosen.type, chosen.item)) selectedEvidence.add(id);
  }
  selected.sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
  return { items: selected, omittedCount: Math.max(0, ranked.length - selected.length) };
}
