import { randomUUID } from "node:crypto";
import { completeJson } from "../llm.js";
import type { GenerationMeta } from "../providers/types.js";
import type {
  ActiveMemoryState,
  ExtractedEpisode,
  ExtractedFact,
  ExtractedScenePatch,
  ExtractedThread,
  MemoryExtractionDraft,
  MemoryExtractionInput,
  MemoryExtractionMode,
  MemoryExtractionReport,
  MemoryThreadKind,
} from "./types.js";
import { collectAnchors, hasNameLikeToken, presentNames, type EntityAnchors } from "./entities.js";
import {
  CHANGE_VERBS,
  COMPLETION_MARKERS,
  FACT_PREDICATES,
  FUNCTION_WORDS,
  MODALITY,
  MOVEMENT_TERMS,
  RHETORICAL_QUESTION_TERMS,
  SECOND_PERSON_TERMS,
  TAG_VOCABULARY,
  TERMINAL_VERBS,
  THREAD_MODALITY,
  THREAD_TERMS,
  countTerms,
  escapeRegExp,
  findTerm,
  hasAnyTerm,
  hasWord,
} from "./lexicon.js";
import { collectBeats, normalizeToken, splitSentences, stripMarkup, type Beat } from "./segments.js";
import { cleanText, clampNumber, describesVisualAppearance, uniqueStrings, validateExtractionDraft } from "./validator.js";

export interface CompleteMemoryJsonResult extends GenerationMeta {
  content: string;
}

export type CompleteMemoryJson = (messages: MemoryExtractionInput[], model?: string) => Promise<CompleteMemoryJsonResult>;

export interface MemoryEntityRef {
  id: string;
  name: string;
}

export interface ExtractActiveMemoryOptions {
  messages: MemoryExtractionInput[];
  state: ActiveMemoryState;
  mode?: MemoryExtractionMode;
  model?: string;
  /** Names the chat already knows (character card + NPC roster), used to disambiguate prose. */
  knownNames?: string[];
  /**
   * Known entities as `{id, name}` (character card + NPC roster). Facts resolve their `entityIds`
   * against this map so the ledger carries stable ids; without it the subject name is stored.
   */
  entities?: MemoryEntityRef[];
  complete?: CompleteMemoryJson;
  now?: () => number;
  idFactory?: () => string;
}

export interface ExtractActiveMemoryResult {
  draft: MemoryExtractionDraft;
  report: MemoryExtractionReport;
  /** Entity map this extraction resolved against; `applyExtractionDraft` reuses it. */
  entities: MemoryEntityRef[];
  meta?: GenerationMeta;
}

/**
 * Confidence gates.
 *
 * The measured baseline emitted a thread for 59% of the sentences it looked at and produced three
 * correct cases out of ten: a `?` was enough for an open question and any keyword substring was
 * enough for a plan. Every candidate now carries a 0..1 score built from its signals (anchored
 * entity, modality, beat type, length, explicit commitment) and only candidates at or above the
 * threshold are emitted. A missed memory costs one line of context; a fabricated one is injected as
 * canon forever, so the gate is deliberately biased towards omission.
 *
 * The arithmetic is small on purpose and every term is a signal a reader can check:
 *   fact    0.40 + (anchor 0.20 known | 0.10 name-like) + (object 0.10 long | 0.05 short) + 0.10 commitment
 *   thread  0.35 + (anchor 0.20 known | 0.10 player-stated) + 0.10 primary modality + 0.05 length + 0.05 spoken
 *   question 0.40 + 0.15 speaker + 0.10 player + 0.10 known interlocutor + 0.05 length
 *   episode 0.40 + (anchor 0.20 | 0.10) + 0.15 completion + 0.05 terminal verb
 * So a quoted question nobody is attributed to (0.40) and a clue stated only in passing with a
 * secondary modality (0.45) fall out, while every anchored, modalised candidate clears the bar.
 */
export const HEURISTIC_CONFIDENCE_THRESHOLD = 0.5;
/** A single turn never adds more than this many threads, highest confidence first. */
export const MAX_THREADS_PER_TURN = 2;
export const MAX_THREAD_TITLE_LENGTH = 200;
export const MAX_EPISODE_SUMMARY_LENGTH = 200;

const THREAD_KIND_ORDER: MemoryThreadKind[] = [
  "promise",
  "threat",
  "secret",
  "clue",
  "goal",
  "conflict",
  "plan",
  "interrupted_action",
];

const RHETORICAL_KEYS = new Set(RHETORICAL_QUESTION_TERMS.map((term) => normalizeToken(term)));

function normalizeKey(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

const FACT_PREDICATE_SOURCE = FACT_PREDICATES.map((predicate) => escapeRegExp(predicate)).join("|");
const FACT_RE = new RegExp(
  `^([\\p{Lu}][\\p{L}\\p{M}\\d _'’-]{0,60}?)\\s+(${FACT_PREDICATE_SOURCE})(?![\\p{L}\\p{N}])\\s+([\\s\\S]{3,600})$`,
  "iu",
);

/** Words that carry content: no stop words, no one-letter leftovers. */
function contentWords(text: string): string[] {
  return text
    .replace(/[^\p{L}\p{N}\s'’-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 2 && !FUNCTION_WORDS.has(normalizeToken(word)));
}

function compactCapture(value: string | undefined, maxLength = 400): string | undefined {
  return cleanText(value?.replace(/[.!?]+$/, ""), maxLength);
}

function tidyTitle(value: string, maxLength = MAX_THREAD_TITLE_LENGTH): string {
  return value
    .replace(/^[\s"'“”«»\-–—]+/, "")
    .replace(/[\s"'“”«»]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function stripQuotes(value: string): string {
  return value.replace(/^["“”'«»\s]+|["“”'«»\s]+$/g, "").trim();
}

function isQuestion(sentence: string): boolean {
  return /[?？]/.test(sentence);
}

function hasSecondPerson(text: string): boolean {
  return hasAnyTerm(text, SECOND_PERSON_TERMS);
}

/** `¿sí?`, `, no?`, `right?`: a tag that closes a clause instead of opening a thread. */
function isRhetoricalTag(clause: string): boolean {
  const words = clause.replace(/[¿?？!¡.,;:]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 3) return false;
  return words.every((word) => RHETORICAL_KEYS.has(normalizeToken(word)));
}

/**
 * The interrogative content of a sentence, or `null` when there is none: a rhetorical tag
 * ("…, ¿sí?") is not a question, and neither is a two-word aside. A real question needs at least
 * three content words, which is what keeps "¿Vas a pagar el alquiler de este mes?" and drops
 * "No puede dormir, ¿sí?".
 */
function interrogativeContent(sentence: string): string | null {
  if (!isQuestion(sentence)) return null;
  const clauses = sentence
    .split(/(?<=[?？])/u)
    .map((clause) => clause.trim())
    .filter((clause) => isQuestion(clause));
  for (const clause of clauses) {
    const tail = clause.split(/[;,]/u).pop()?.trim() ?? clause;
    if (tail !== clause && isRhetoricalTag(tail)) continue;
    if (isRhetoricalTag(clause)) continue;
    if (contentWords(clause).length >= 3) return clause;
  }
  return null;
}

/** Explicit movement/state patterns: a location is never guessed from an arbitrary sentence. */
const LOCATION_PATTERNS = [
  // Movement verbs cover the way scenes actually change in prose ("caminamos hacia la cripta"),
  // not only the static "estamos en" phrasing.
  /\b(?:caminamos|fuimos|vamos|nos dirigimos|avanzamos|llegamos|entramos|salimos)\s+(?:hacia|a|al|en|de)\s+(?:el|la|los|las|un|una)?\s*([^.!?]{3,100})/iu,
  /\b(?:estamos|estaban|están|se encuentran|llegaron|llegó|entraron|entró)\s+(?:en|a)\s+(?:el|la|los|las|un|una)?\s*([^.!?]{3,100})/iu,
  // The prepositions repeat and need a trailing space: "walked toward the crypt" must not let the
  // "to" of "toward" eat the word (that bug captured "ward the crypt").
  /\b(?:we are|they are|arrived|entered|walked|heading|went|moved|came|ran)\s+(?:(?:in|into|at|to|towards|toward|inside|through|the)\s+)*([^.!?]{3,100})/iu,
];

function matchLocation(text: string): string | undefined {
  for (const pattern of LOCATION_PATTERNS) {
    const match = text.match(pattern);
    const location = compactCapture(match?.[1], 200);
    if (location) return location;
  }
  return undefined;
}

function participantsOf(sentence: string, anchors: EntityAnchors, beat?: Beat): string[] {
  const names = presentNames(sentence, anchors);
  if (beat?.speaker && !names.includes(beat.speaker)) names.unshift(beat.speaker);
  return uniqueStrings(names);
}

/**
 * Facts: a curated predicate, a subject that is either an anchored name or a single capitalised
 * non-blocked token (the window may be one message long), and an object of at least two content
 * words. "Su cara de mañana es de gata descansada" is rejected because "Su cara de mañana" is not a
 * name; "Daren tiene la llave plateada" survives.
 */
function factFromSentence(sentence: string, messageId: string, anchors: EntityAnchors, lowercaseVocabulary: Set<string>): ExtractedFact | null {
  if (isQuestion(sentence)) return null;
  const cleaned = stripQuotes(sentence);
  const match = cleaned.match(FACT_RE);
  if (!match) return null;
  const subject = compactCapture(match[1], 120);
  const predicate = compactCapture(match[2], 80);
  const object = compactCapture(match[3], 600);
  if (!subject || !predicate || !object) return null;
  if (contentWords(object).length < 2) return null;

  const subjectKey = normalizeToken(subject);
  const anchored = anchors.keys.has(subjectKey);
  if (!anchored) {
    // Soft anchor: one capitalised token that nothing else in the window contradicts. A determiner
    // plus a common noun ("El Televisor") only counts when the chat actually knows that entity.
    const tokens = subject.split(/\s+/).filter(Boolean);
    if (tokens.length !== 1 || !/^[\p{Lu}]/u.test(tokens[0])) return null;
    if (FUNCTION_WORDS.has(subjectKey) || TAG_VOCABULARY.has(subjectKey)) return null;
    if (lowercaseVocabulary.has(subjectKey)) return null;
    if (tokens[0].length > 1 && tokens[0] === tokens[0].toLocaleUpperCase() && !/[\p{Ll}]/u.test(tokens[0])) return null;
  }


  const confidence = clampNumber(
    0.4 + (anchored ? 0.2 : 0.1) + (contentWords(object).length >= 3 ? 0.1 : 0.05) + (hasWord(cleaned, "promet(?:ió|ieron)|jur(?:ó|aron)|confes(?:ó|aron)|descubr(?:ió|ieron)") ? 0.1 : 0),
    0.4,
  );
  if (confidence < HEURISTIC_CONFIDENCE_THRESHOLD) return null;
  return {
    subject,
    predicate: predicate.toLocaleLowerCase(),
    object,
    confidence,
    importance: /promet|jur|confes|perdi|lost|secret|secreto/iu.test(cleaned) ? 0.8 : 0.55,
    visibleTo: "all",
    evidenceMessageIds: [messageId],
    status: "candidate",
  };
}

function questionThread(sentence: string, beat: Beat, anchors: EntityAnchors): ExtractedThread | null {
  const clause = interrogativeContent(sentence);
  if (!clause) return null;
  // A question is a thread only when it is spoken or thought, and only when it is addressed to
  // someone: a speaker, a second-person marker, a named interlocutor, or the player asking.
  const spoken = beat.kind === "dialogue" || beat.kind === "thought";
  const addressed = spoken || beat.role === "user" || hasSecondPerson(clause);
  if (!spoken && beat.role !== "user") return null;
  if (!addressed) return null;
  const hardAnchor = presentNames(sentence, anchors).length > 0;
  const confidence = clampNumber(
    0.4 +
      (beat.speaker ? 0.15 : 0) +
      (beat.role === "user" ? 0.1 : 0) +
      (hardAnchor ? 0.1 : 0) +
      (hasSecondPerson(clause) ? 0.05 : 0) +
      (contentWords(clause).length >= 4 ? 0.05 : 0),
    0.4,
  );
  if (confidence < HEURISTIC_CONFIDENCE_THRESHOLD) return null;
  return {
    title: tidyTitle(clause),
    kind: "question",
    participantIds: participantsOf(sentence, anchors, beat),
    evidenceMessageIds: [beat.messageId],
    priority: confidence,
    confidence,
    status: "open",
  };
}

/**
 * Keyword threads. Whole-word matching decides the kind (so "skill" is not a threat and "planes" is
 * not a plan), and the sentence must then pass three gates: it is not a question, it anchors on an
 * entity, and it carries the modality the kind implies. A present-tense description such as
 * "la sicubo discute el contrato" has no modality mark and never opens a conflict.
 */
function keywordThread(sentence: string, beat: Beat, anchors: EntityAnchors): ExtractedThread | null {
  if (isQuestion(sentence)) return null;
  const hardAnchor = presentNames(sentence, anchors).length > 0;
  // The player's own message is intent evidence; assistant prose must anchor on a known entity.
  const softAnchor = !hardAnchor && beat.role === "user";
  if (!hardAnchor && !softAnchor) return null;

  // Several kinds can share a sentence ("debemos buscar la llave" is a clue and a goal). The
  // strongest reading wins instead of the first one in the list.
  let best: { kind: MemoryThreadKind; confidence: number } | undefined;
  for (const kind of THREAD_KIND_ORDER) {
    const terms = THREAD_TERMS[kind];
    if (!terms || !hasAnyTerm(sentence, terms)) continue;
    const categories = THREAD_MODALITY[kind] ?? [];
    const category = categories.find((name) => hasAnyTerm(sentence, MODALITY[name]));
    if (!category) continue;
    // More matching terms for the same kind is more evidence: "nadie sabe … guardar el secreto"
    // is a secret twice over, so it outranks the bare "juró" reading of the same sentence.
    const density = Math.min(2, countTerms(sentence, terms) - 1);
    const confidence = clampNumber(
      0.35 +
        (hardAnchor ? 0.2 : 0.1) +
        (categories[0] === category ? 0.1 : 0) +
        (contentWords(sentence).length >= 4 ? 0.05 : 0) +
        (beat.kind === "narration" ? 0 : 0.05) +
        density * 0.05,
      0.35,
    );
    if (confidence < HEURISTIC_CONFIDENCE_THRESHOLD) continue;
    if (!best || confidence > best.confidence) best = { kind, confidence };
  }
  if (!best) return null;
  return {
    title: tidyTitle(sentence),
    kind: best.kind,
    participantIds: participantsOf(sentence, anchors, beat),
    evidenceMessageIds: [beat.messageId],
    priority: best.confidence,
    confidence: best.confidence,
    status: "open",
  };
  return null;
}

/**
 * Episodes: a completed change of state, not a description. The beat needs a past-tense change verb,
 * an anchor (a named entity, a name-like token, or an explicit new place) and a completion signal:
 * a second change verb, a completion marker, a terminal verb such as "murió", or "por primera vez".
 */
function episodeFromSentence(sentence: string, beat: Beat, anchors: EntityAnchors): ExtractedEpisode | null {
  if (isQuestion(sentence)) return null;
  const changeHits = countTerms(sentence, CHANGE_VERBS);
  const location = hasAnyTerm(sentence, MOVEMENT_TERMS) ? matchLocation(sentence) : undefined;
  if (!changeHits && !location) return null;

  const hardAnchor = presentNames(sentence, anchors).length > 0;
  const nameLike = !hardAnchor && hasNameLikeToken(sentence);
  if (!hardAnchor && !nameLike && !location) return null;

  const terminal = changeHits > 0 && hasAnyTerm(sentence, TERMINAL_VERBS);
  const complete = changeHits >= 2 || terminal || hasAnyTerm(sentence, COMPLETION_MARKERS) || /por primera vez/iu.test(sentence);
  if (changeHits > 0 && !complete) return null;

  const confidence = clampNumber(
    0.4 + (hardAnchor ? 0.2 : nameLike ? 0.1 : 0.1) + (changeHits >= 2 || complete ? 0.15 : 0.1) + (terminal ? 0.05 : 0),
    0.4,
  );
  if (confidence < HEURISTIC_CONFIDENCE_THRESHOLD) return null;

  return {
    summary: tidyTitle(stripQuotes(sentence), MAX_EPISODE_SUMMARY_LENGTH),
    participantIds: participantsOf(sentence, anchors, beat),
    location,
    emotionalWeight: clampNumber(0.65 + (terminal ? 0.1 : 0), 0.65),
    confidence,
    sourceMessageIds: [beat.messageId],
  };
}

export interface HeuristicExtractionOptions {
  knownNames?: string[];
  /**
   * Skip facts about clothing, outfit or physical appearance: Image Director keeps that ledger, and
   * two systems writing the same state is how a character ends up in two outfits at once.
   */
  deferVisualFactsToDirector?: boolean;
}

/**
 * Maps the entity names a fact mentions to their stable ids. The subject is usually the entity, but
 * the object can mention a second one ("Daren protege a Iris"), so both are searched. A fact whose
 * entities cannot be resolved keeps the subject name, which is still better evidence than nothing
 * and keeps the field non-empty for old ledgers.
 */
export function resolveFactEntityIds(
  candidate: Pick<ExtractedFact, "subject" | "object">,
  entities: MemoryEntityRef[],
): string[] {
  if (!entities.length) return uniqueStrings([candidate.subject]);
  const haystack = ` ${normalizeKey(`${candidate.subject} ${candidate.object}`)} `;
  const ids: string[] = [];
  for (const entity of entities) {
    const name = normalizeKey(entity.name ?? "");
    if (!entity.id || !name) continue;
    if (haystack.includes(` ${name} `)) ids.push(entity.id);
  }
  const resolved = [...new Set(ids)];
  return resolved.length ? resolved : uniqueStrings([candidate.subject]);
}

function inferScene(
  messages: MemoryExtractionInput[],
  anchors: EntityAnchors,
  beats: Beat[],
  cleanText: string,
): ExtractedScenePatch | undefined {
  const last = messages[messages.length - 1];
  if (!last) return undefined;
  const scene: ExtractedScenePatch = {
    presentCharacterIds: presentNames(cleanText, anchors),
    evidenceMessageIds: [last.id],
  };
  const location = matchLocation(cleanText);
  if (location) scene.location = location;
  const time = cleanText.match(/\b(?:al amanecer|al anochecer|de madrugada|a medianoche|por la mañana|por la tarde|por la noche|dawn|dusk|midnight)\b/iu)?.[0];
  if (time) scene.narrativeTime = time;
  const goal = cleanText.match(/\b(?:debemos|tenemos que|hay que|nuestro objetivo es|need to|must)\s+([^.!?]{3,180})/iu)?.[1];
  if (goal) scene.immediateGoal = compactCapture(goal, 300);
  const pending = cleanText.match(/\b(?:antes de poder|queda por|todavía falta|interrump(?:ido|ida)|pending|still need to)\s+([^.!?]{3,180})/iu)?.[1];
  if (pending) scene.pendingAction = compactCapture(pending, 300);
  // Only narration and action describe what actually changed on stage; dialogue is opinion.
  const change = [...beats].reverse().find((beat) => beat.kind === "narration" || beat.kind === "action");
  if (change) {
    const sentences = splitSentences(change.text);
    scene.lastSignificantChange = (sentences.at(-1) ?? change.text).slice(0, MAX_EPISODE_SUMMARY_LENGTH);
  }
  return scene;
}

/** Words that also appear in lowercase somewhere in the window are common nouns, not names. */
function lowercaseVocabulary(cleanText: string): Set<string> {
  const words = new Set<string>();
  for (const match of cleanText.matchAll(/(?<![\p{L}\p{N}])[\p{Ll}][\p{L}\p{M}'’-]{2,29}/gu)) {
    words.add(normalizeToken(match[0]));
  }
  return words;
}

export function extractWithHeuristics(
  messages: MemoryExtractionInput[],
  options: HeuristicExtractionOptions = {},
): MemoryExtractionDraft {
  const anchors = collectAnchors(messages, options.knownNames ?? []);
  const { text: cleanText, beats } = collectBeats(messages);
  const lowercaseWords = lowercaseVocabulary(cleanText);

  const facts: ExtractedFact[] = [];
  const threadCandidates: ExtractedThread[] = [];
  const episodes: ExtractedEpisode[] = [];

  for (const beat of beats) {
    for (const sentence of splitSentences(beat.text)) {
      const fact = factFromSentence(sentence, beat.messageId, anchors, lowercaseWords);
      if (fact) {
        const visual = describesVisualAppearance(fact.subject, fact.predicate, fact.object);
        if (!(visual && options.deferVisualFactsToDirector)) facts.push(fact);
      }
      const thread = questionThread(sentence, beat, anchors) ?? keywordThread(sentence, beat, anchors);
      if (thread) threadCandidates.push(thread);
      const episode = episodeFromSentence(sentence, beat, anchors);
      if (episode) episodes.push(episode);
    }
  }

  const dedupedFacts: ExtractedFact[] = [];
  const factKeys = new Set<string>();
  for (const fact of facts) {
    const key = `${normalizeKey(fact.subject)}|${normalizeKey(fact.predicate)}|${normalizeKey(fact.object)}`;
    if (factKeys.has(key)) continue;
    factKeys.add(key);
    dedupedFacts.push(fact);
  }

  const dedupedEpisodes: ExtractedEpisode[] = [];
  const episodeKeys = new Set<string>();
  for (const episode of [...episodes].sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0))) {
    const key = normalizeKey(episode.summary);
    if (!key || episodeKeys.has(key)) continue;
    episodeKeys.add(key);
    dedupedEpisodes.push(episode);
  }

  // At most two new threads per turn: a turn that suggests ten pending items fills the ledger with
  // speculation, so only the highest-confidence two survive.
  const threads = threadCandidates
    .filter((thread) => (thread.confidence ?? 0) >= HEURISTIC_CONFIDENCE_THRESHOLD)
    .sort((left, right) => {
      const byConfidence = (right.confidence ?? 0) - (left.confidence ?? 0);
      if (byConfidence !== 0) return byConfidence;
      // At equal confidence a question someone actually asked outranks a narration claim.
      return (right.kind === "question" ? 1 : 0) - (left.kind === "question" ? 1 : 0);
    })
    .slice(0, MAX_THREADS_PER_TURN);

  return {
    scene: inferScene(messages, anchors, beats, cleanText),
    facts: dedupedFacts,
    threads,
    episodes: dedupedEpisodes,
  };
}

function parseJsonObject(content: string): unknown {
  const unfenced = content.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(unfenced.slice(start, end + 1));
    throw new Error("The memory extractor did not return a JSON object");
  }
}

async function defaultComplete(messages: MemoryExtractionInput[], model?: string): Promise<CompleteMemoryJsonResult> {
  const transcript = messages.map((message) => `[${message.id}] ${message.role}: ${message.content}`).join("\n\n");
  return completeJson(
    {
      model: model || undefined,
      maxTokens: 3_500,
      messages: [
        {
          role: "system",
          content:
            "Extract only verifiable narrative memory from the supplied messages. Return one JSON object with optional scene and arrays facts, threads, episodes. Every item must cite evidenceMessageIds/sourceMessageIds using only the exact IDs supplied. facts need subject, predicate, object, confidence 0..1, importance 0..1, visibleTo ('all' or IDs). threads need title, kind (promise|question|goal|threat|secret|plan|conflict|clue|interrupted_action), priority 0..1 and evidenceMessageIds. Do not infer unsupported details.",
        },
        { role: "user", content: transcript },
      ],
    },
    new AbortController().signal,
  );
}

export async function extractActiveMemory(options: ExtractActiveMemoryOptions): Promise<ExtractActiveMemoryResult> {
  const requestedMode = options.mode ?? options.state.settings.extractionMode;
  const complete = options.complete ?? defaultComplete;
  const warnings: string[] = [];
  let draft: MemoryExtractionDraft;
  let method: MemoryExtractionReport["method"] = "heuristic";
  let meta: GenerationMeta | undefined;

  if (requestedMode === "heuristic") {
    draft = extractWithHeuristics(options.messages, {
      knownNames: options.knownNames,
      deferVisualFactsToDirector: options.state.settings.deferVisualFactsToDirector,
    });
  } else {
    try {
      const response = await complete(options.messages, options.model ?? options.state.settings.model);
      const validated = validateExtractionDraft(parseJsonObject(response.content), options.messages.map((message) => message.id));
      draft = validated.draft;
      warnings.push(...validated.warnings);
      meta = { provider: response.provider, model: response.model, usage: response.usage };
      method = "llm";
    } catch (error) {
      draft = extractWithHeuristics(options.messages, { knownNames: options.knownNames });
      method = "heuristic-fallback";
      warnings.push(`LLM extraction failed; heuristic fallback used: ${error instanceof Error ? error.message : "unknown error"}`);
    }
    // The LLM path must honour the same guarantee as the heuristic one: when visual facts are
    // deferred, an outfit/appearance fact never reaches the ledger even if the model returned it.
    if (options.state.settings.deferVisualFactsToDirector) {
      const kept = draft.facts.filter((fact) => !describesVisualAppearance(fact.subject, fact.predicate, fact.object));
      const dropped = draft.facts.length - kept.length;
      if (dropped > 0) {
        draft = { ...draft, facts: kept };
        warnings.push(`Deferred ${dropped} visual/appearance fact(s) to Image Director.`);
      }
    }
  }

  return {
    draft,
    entities: options.entities ?? [],
    meta,
    report: {
      requestedMode,
      method,
      processedMessageIds: options.messages.map((message) => message.id),
      addedFacts: 0,
      updatedFacts: 0,
      addedThreads: 0,
      updatedThreads: 0,
      addedEpisodes: 0,
      updatedScene: false,
      warnings,
    },
  };
}

function mergeIds(left: string[], right: string[]): string[] {
  return [...new Set([...left, ...right])];
}

export interface ApplyExtractionOptions {
  now?: () => number;
  idFactory?: () => string;
  /** Overrides the entity map carried by the extraction result (character card + NPC roster). */
  entities?: MemoryEntityRef[];
}

export function applyExtractionDraft(
  state: ActiveMemoryState,
  extraction: ExtractActiveMemoryResult,
  options: ApplyExtractionOptions = {},
): MemoryExtractionReport {
  const now = options.now ?? Date.now;
  const idFactory = options.idFactory ?? randomUUID;
  const entities = options.entities ?? extraction.entities ?? [];
  const timestamp = now();
  const report = structuredClone(extraction.report);
  const { draft } = extraction;

  if (draft.scene && Object.keys(draft.scene).length > 0) {
    state.scene = {
      ...state.scene,
      ...draft.scene,
      presentCharacterIds: draft.scene.presentCharacterIds ?? state.scene.presentCharacterIds,
      relevantObjects: draft.scene.relevantObjects ?? state.scene.relevantObjects,
      evidenceMessageIds: mergeIds(state.scene.evidenceMessageIds, draft.scene.evidenceMessageIds ?? []),
      updatedAt: timestamp,
    };
    report.updatedScene = true;
  }

  for (const candidate of draft.facts) {
    const entityIds = resolveFactEntityIds(candidate, entities);
    const key = `${normalizeKey(candidate.subject)}|${normalizeKey(candidate.predicate)}|${normalizeKey(candidate.object)}`;
    const exact = state.facts.find(
      (fact) => `${normalizeKey(fact.subject)}|${normalizeKey(fact.predicate)}|${normalizeKey(fact.object)}` === key,
    );
    if (exact) {
      exact.evidenceMessageIds = mergeIds(exact.evidenceMessageIds, candidate.evidenceMessageIds);
      // Re-resolving on update lets an entity map that arrived later (the NPC roster was created
      // after the fact) upgrade a name placeholder to a real id.
      exact.entityIds = mergeIds(exact.entityIds ?? [], entityIds);
      exact.confidence = Math.max(exact.confidence, clampNumber(candidate.confidence, 0.65));
      exact.importance = Math.max(exact.importance, clampNumber(candidate.importance, 0.5));
      exact.updatedAt = timestamp;
      if (candidate.status === "confirmed") exact.status = "confirmed";
      report.updatedFacts += 1;
      continue;
    }
    const sourceMessageId = candidate.evidenceMessageIds[0];
    const conflicting = state.facts.find(
      (fact) =>
        !fact.validUntilMessageId &&
        fact.status !== "invalidated" &&
        normalizeKey(fact.subject) === normalizeKey(candidate.subject) &&
        normalizeKey(fact.predicate) === normalizeKey(candidate.predicate) &&
        normalizeKey(fact.object) !== normalizeKey(candidate.object),
    );
    if (conflicting) {
      conflicting.validUntilMessageId = sourceMessageId;
      conflicting.status = "disputed";
      conflicting.updatedAt = timestamp;
    }
    state.facts.push({
      id: idFactory(),
      subject: candidate.subject,
      predicate: candidate.predicate,
      object: candidate.object,
      status: candidate.status ?? "candidate",
      confidence: clampNumber(candidate.confidence, 0.65),
      importance: clampNumber(candidate.importance, 0.5),
      visibleTo: candidate.visibleTo ?? "all",
      evidenceMessageIds: uniqueStrings(candidate.evidenceMessageIds),
      validFromMessageId: sourceMessageId,
      pinned: candidate.pinned === true,
      entityIds,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    report.addedFacts += 1;
  }

  for (const candidate of draft.threads) {
    const key = normalizeKey(candidate.title);
    const exact = state.threads.find((thread) => normalizeKey(thread.title) === key);
    if (exact) {
      exact.evidenceMessageIds = mergeIds(exact.evidenceMessageIds, candidate.evidenceMessageIds);
      exact.participantIds = mergeIds(exact.participantIds, candidate.participantIds ?? []);
      exact.priority = Math.max(exact.priority, clampNumber(candidate.priority, 0.5, 0, 5));
      exact.lastMentionedAt = timestamp;
      if (candidate.status) exact.status = candidate.status;
      report.updatedThreads += 1;
      continue;
    }
    state.threads.push({
      id: idFactory(),
      title: candidate.title,
      kind: candidate.kind,
      status: candidate.status ?? "open",
      participantIds: uniqueStrings(candidate.participantIds),
      evidenceMessageIds: uniqueStrings(candidate.evidenceMessageIds),
      priority: clampNumber(candidate.priority, 0.5, 0, 5),
      lastMentionedAt: timestamp,
      resolutionCondition: candidate.resolutionCondition,
      pinned: candidate.pinned === true,
    });
    report.addedThreads += 1;
  }

  for (const candidate of draft.episodes) {
    if (state.episodes.some((episode) => normalizeKey(episode.summary) === normalizeKey(candidate.summary))) continue;
    state.episodes.push({
      id: idFactory(),
      summary: candidate.summary,
      participantIds: uniqueStrings(candidate.participantIds),
      location: candidate.location,
      outcome: candidate.outcome,
      emotionalWeight: clampNumber(candidate.emotionalWeight, 0.5),
      sourceMessageIds: uniqueStrings(candidate.sourceMessageIds),
      occurredAt: candidate.occurredAt,
      createdAt: timestamp,
      pinned: candidate.pinned === true,
    });
    report.addedEpisodes += 1;
  }

  state.facts.sort((a, b) => a.id.localeCompare(b.id));
  state.threads.sort((a, b) => a.id.localeCompare(b.id));
  state.episodes.sort((a, b) => a.id.localeCompare(b.id));
  state.lastProcessedMessageId = report.processedMessageIds.at(-1) ?? state.lastProcessedMessageId;
  return report;
}

export { findTerm, hasWord, stripMarkup, collectBeats, splitSentences };
