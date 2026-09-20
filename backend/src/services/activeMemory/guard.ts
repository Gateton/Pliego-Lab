// Continuity Guard: a read-only pass over a generated reply that flags statements which appear to
// contradict facts the chat already committed to. It never rewrites the prose — it only reports, so
// the caller (UI or pipeline) decides whether to surface, ignore or re-roll. Two engines exist:
// an LLM pass for subtle contradictions and an offline heuristic that is always available, so a
// missing or failing provider degrades gracefully instead of throwing.

import { completeJson } from "../llm.js";
import type { ActiveMemoryState, GuardFinding, GuardReport, MemoryExtractionMode, MemoryFact } from "./types.js";
import { cleanText } from "./validator.js";

export interface CheckContinuityOptions {
  state: ActiveMemoryState;
  responseText: string;
  messageId?: string;
  responderId?: string;
  mode?: "heuristic" | "llm" | "auto";
  model?: string;
  complete?: (
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    model?: string,
  ) => Promise<{ content: string }>;
  now?: () => number;
}

const SEVERITIES = new Set<GuardFinding["severity"]>(["low", "medium", "high"]);
const MAX_FINDINGS = 25;
const MAX_PROMPT_FACTS = 20;

/**
 * Reversal / negation cues. Matching folds accents ("dejó" -> "dejo") so the list can stay short and
 * still catch both spellings without duplicating every entry.
 */
const NEGATION_MARKERS = [
  "no longer",
  "ya no",
  "dejo de",
  "dejar de",
  "nunca",
  "jamas",
  "revirtio",
  "revertido",
  "volvio a",
  "renuncio a",
  "rompio su promesa",
  "rompio la promesa",
  "broke his promise",
  "broke her promise",
  "broke their promise",
  "renounced",
  "reverted",
  "no volvio a",
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceParts(content: string): string[] {
  return content
    .replace(/\r/g, "")
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((sentence) => sentence.replace(/^[-*\s]+/, "").trim())
    .filter((sentence) => sentence.length >= 4 && sentence.length <= 1_000);
}

/** Word-boundary aware containment check on already-normalized text, so "Iris" never matches "Irisa". */
function mentions(normalizedText: string, needle: string): boolean {
  if (!needle) return false;
  let index = normalizedText.indexOf(needle);
  while (index >= 0) {
    const before = index > 0 ? normalizedText[index - 1] : "";
    const after = index + needle.length < normalizedText.length ? normalizedText[index + needle.length] : "";
    const isWordChar = (character: string) => /[\p{L}\p{N}_]/u.test(character);
    if (!isWordChar(before) && !isWordChar(after)) return true;
    index = normalizedText.indexOf(needle, index + 1);
  }
  return false;
}

function factText(fact: MemoryFact): string {
  return `${fact.subject} ${fact.predicate} ${fact.object}`;
}

/** A fact is "current" when nothing superseded or invalidated it yet. */
function isCurrentFact(fact: MemoryFact): boolean {
  return fact.status !== "invalidated" && !fact.validUntilMessageId;
}

/**
 * Every current fact is watchable, including candidates.
 *
 * Extraction produces "candidate" facts, so guarding only confirmed ones made the guard silent until
 * a human curated the whole ledger — which never happens mid-story. Severity carries the difference
 * instead: the guard only informs, and a candidate contradicting a reply is exactly the signal the
 * user needs to confirm or drop it.
 */
function isGuardableFact(fact: MemoryFact): boolean {
  return isCurrentFact(fact) && fact.status !== "disputed";
}

/** Confidence in the fact drives how loudly the guard reports a contradiction. */
function severityFor(fact: MemoryFact): GuardFinding["severity"] {
  if (fact.pinned === true || fact.status === "confirmed") return "high";
  return fact.confidence >= 0.75 ? "medium" : "low";
}

function mentionsResponder(fact: MemoryFact, responderId: string | undefined): boolean {
  if (!responderId) return false;
  const needle = normalize(responderId);
  if (!needle) return false;
  return (
    fact.entityIds.some((entityId) => normalize(entityId) === needle) ||
    mentions(normalize(fact.subject), needle) ||
    mentions(normalize(fact.object), needle)
  );
}

function visibleToResponder(fact: MemoryFact, responderId: string | undefined): boolean {
  if (!responderId || fact.visibleTo === "all") return true;
  return fact.visibleTo.includes(responderId);
}

/**
 * The prompt only carries facts the guard could plausibly contradict: current, visible, and either
 * about the responder or important enough to matter. Sending the whole ledger invites the model to
 * invent contradictions, which the validator then has to throw away.
 */
export function selectGuardFacts(state: ActiveMemoryState, responderId: string | undefined): MemoryFact[] {
  const current = state.facts.filter((fact) => isCurrentFact(fact) && visibleToResponder(fact, responderId));
  const relevant = current.filter((fact) => mentionsResponder(fact, responderId));
  const rest = current
    .filter((fact) => !relevant.includes(fact))
    .sort((a, b) => b.importance - a.importance || (b.pinned === true ? 1 : 0) - (a.pinned === true ? 1 : 0) || b.updatedAt - a.updatedAt);
  const restLimit = Math.max(0, MAX_PROMPT_FACTS - relevant.length);
  return [...relevant, ...rest.slice(0, restLimit)].slice(0, MAX_PROMPT_FACTS);
}

export function detectHeuristicFindings(
  facts: MemoryFact[],
  responseText: string,
): GuardFinding[] {
  const sentences = sentenceParts(responseText).map((sentence) => ({ raw: sentence, normalized: normalize(sentence) }));
  const findings: GuardFinding[] = [];
  for (const fact of facts) {
    if (!isGuardableFact(fact)) continue;
    const subject = normalize(fact.subject);
    const object = normalize(fact.object);
    for (const sentence of sentences) {
      if (!mentions(sentence.normalized, subject) && !mentions(sentence.normalized, object)) continue;
      const marker = NEGATION_MARKERS.find((candidate) => mentions(sentence.normalized, candidate));
      if (!marker) continue;
      findings.push({
        factId: fact.id,
        excerpt: sentence.raw,
        reason: `Reply negates the known fact "${factText(fact)}" ("${marker}").`,
        severity: severityFor(fact),
      });
      break;
    }
    if (findings.length >= MAX_FINDINGS) break;
  }
  return findings;
}

function parseJsonObject(content: string): unknown {
  const unfenced = content.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(unfenced.slice(start, end + 1));
    throw new Error("The continuity guard did not return a JSON object");
  }
}

function severityOf(value: unknown): GuardFinding["severity"] {
  return SEVERITIES.has(value as GuardFinding["severity"]) ? (value as GuardFinding["severity"]) : "medium";
}

/**
 * Model output is treated as a proposal, never as truth: a finding survives only if it points at a
 * fact that exists in the ledger and quotes text that actually appears in the reply. Anything else
 * is dropped (and reported) so the guard cannot fabricate contradictions.
 */
export function validateGuardFindings(
  value: unknown,
  state: ActiveMemoryState,
  responseText: string,
): { findings: GuardFinding[]; warnings: string[] } {
  const root = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const raw = Array.isArray(root.contradictions) ? root.contradictions.slice(0, MAX_FINDINGS * 2) : [];
  const knownIds = new Set(state.facts.map((fact) => fact.id));
  const normalizedResponse = normalize(responseText);
  const findings: GuardFinding[] = [];
  let rejectedUnknownFact = 0;
  let rejectedExcerpt = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      rejectedUnknownFact += 1;
      continue;
    }
    const candidate = item as Record<string, unknown>;
    const factId = cleanText(candidate.factId, 120);
    if (!factId || !knownIds.has(factId)) {
      rejectedUnknownFact += 1;
      continue;
    }
    const excerpt = cleanText(candidate.excerpt, 1_000);
    if (!excerpt || !mentions(normalizedResponse, normalize(excerpt))) {
      rejectedExcerpt += 1;
      continue;
    }
    const fact = state.facts.find((entry) => entry.id === factId);
    findings.push({
      factId,
      excerpt,
      reason: cleanText(candidate.reason, 500) ?? `Reply contradicts the known fact "${fact ? factText(fact) : factId}".`,
      severity: severityOf(candidate.severity),
    });
    if (findings.length >= MAX_FINDINGS) break;
  }
  const warnings: string[] = [];
  if (rejectedUnknownFact > 0) {
    warnings.push(`Discarded ${rejectedUnknownFact} contradiction(s) that did not cite a known fact id.`);
  }
  if (rejectedExcerpt > 0) {
    warnings.push(`Discarded ${rejectedExcerpt} contradiction(s) whose excerpt was not found literally in the reply.`);
  }
  return { findings, warnings };
}

function buildPrompt(facts: MemoryFact[], responseText: string): Array<{ role: "system" | "user"; content: string }> {
  const ledger = facts.map((fact) => `- [${fact.id}] ${fact.subject} ${fact.predicate} ${fact.object}`).join("\n");
  return [
    {
      role: "system",
      content:
        "You are a continuity checker for a roleplay transcript. Compare the assistant reply against the known facts and report only direct contradictions. Return one JSON object: {contradictions: [{factId, excerpt, reason, severity}]}. factId must be one of the ids listed below. excerpt must be copied verbatim from the reply, character for character. severity is low|medium|high. If nothing contradicts, return {contradictions: []}. Never rewrite the reply.",
    },
    {
      role: "user",
      content: `Known facts:\n${ledger || "(none)"}\n\nAssistant reply:\n${responseText}`,
    },
  ];
}

async function defaultComplete(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  model?: string,
): Promise<{ content: string }> {
  return completeJson(
    {
      model: model || undefined,
      maxTokens: 1_200,
      messages,
    },
    new AbortController().signal,
  );
}

function emptyReport(checkedAt: number): GuardReport {
  return { checkedAt, method: "heuristic", findings: [], warnings: [] };
}

/**
 * Runs the guard over one reply. Never throws and never blocks the caller: provider errors, bad JSON
 * and rejected findings all turn into warnings on a heuristic report.
 */
export async function checkContinuity(options: CheckContinuityOptions): Promise<GuardReport> {
  const now = options.now ?? Date.now;
  const checkedAt = now();
  const { state, responseText } = options;
  const base: Pick<GuardReport, "checkedAt" | "messageId"> = {
    checkedAt,
    ...(options.messageId ? { messageId: options.messageId } : {}),
  };

  if (!state.settings.enabled) return emptyReport(checkedAt);

  const requestedMode: MemoryExtractionMode = options.mode ?? state.settings.extractionMode;
  const warnings: string[] = [];

  const heuristic = (method: GuardReport["method"]): GuardReport => ({
    ...base,
    method,
    findings: detectHeuristicFindings(state.facts, responseText),
    warnings,
  });

  if (requestedMode === "heuristic") {
    return { ...heuristic("heuristic") };
  }

  try {
    const complete = options.complete ?? defaultComplete;
    const facts = selectGuardFacts(state, options.responderId);
    const response = await complete(buildPrompt(facts, responseText), options.model ?? state.settings.model);
    const validated = validateGuardFindings(parseJsonObject(response.content), state, responseText);
    warnings.push(...validated.warnings);
    return { ...base, method: "llm", findings: validated.findings, warnings };
  } catch (error) {
    warnings.push(`LLM continuity check failed; heuristic fallback used: ${error instanceof Error ? error.message : "unknown error"}`);
    return heuristic("heuristic-fallback");
  }
}

/** Persists the report so the UI can show the last pass without recomputing it. */
export function applyGuardReport(state: ActiveMemoryState, report: GuardReport): void {
  state.lastGuard = { ...report, findings: report.findings.map((finding) => ({ ...finding })), warnings: [...report.warnings] };
}
