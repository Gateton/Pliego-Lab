import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { applyExtractionDraft, extractActiveMemory, extractWithHeuristics } from "./extractor.js";
import { commitBriefTrace, compileActiveMemoryBrief, resolveBriefCharacterBudget } from "./compiler.js";
import { retrieveActiveMemory } from "./retriever.js";
import { segmentLine } from "./segments.js";
import { describesVisualAppearance, validateExtractionDraft } from "./validator.js";
import {
  createActiveMemoryStore,
  createDefaultActiveMemoryState,
  normalizeActiveMemoryState,
} from "./store.js";
import { createSharedLedgerStore, mergeSharedLedger, publishToSharedLedger, scopeIsShared } from "./scope.js";
import { applySettingsPatch, invalidateMemoryEvidence, mergeMemoryItems, patchMemoryItem } from "../../routes/activeMemory.js";
import type {
  MemoryEpisode,
  MemoryExtractionInput,
  MemoryFact,
  MemoryItemType,
  MemoryThread,
} from "./types.js";

function memoryFact(overrides: Partial<MemoryFact> & Pick<MemoryFact, "id" | "subject" | "predicate" | "object">): MemoryFact {
  return {
    status: "confirmed",
    confidence: 0.8,
    importance: 0.6,
    visibleTo: "all",
    evidenceMessageIds: ["m1"],
    validFromMessageId: "m1",
    entityIds: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function memoryThread(overrides: Partial<MemoryThread> & Pick<MemoryThread, "id" | "title">): MemoryThread {
  return {
    kind: "promise",
    status: "open",
    participantIds: [],
    evidenceMessageIds: ["m1"],
    priority: 0.6,
    lastMentionedAt: 1,
    ...overrides,
  };
}

function memoryEpisode(overrides: Partial<MemoryEpisode> & Pick<MemoryEpisode, "id" | "summary">): MemoryEpisode {
  return {
    participantIds: [],
    sourceMessageIds: ["m1"],
    createdAt: 1,
    ...overrides,
  };
}

function inputs(entries: Array<[string, string, string]>): MemoryExtractionInput[] {
  return entries.map(([id, role, content]) => ({
    id,
    role: role === "user" ? ("user" as const) : ("assistant" as const),
    content,
    createdAt: 1_700_000_000_000,
  }));
}

test("normalizes corrupt stored state instead of throwing", () => {
  const state = normalizeActiveMemoryState({ facts: "nope", scene: 42, version: 99 });
  assert.equal(state.facts.length, 0);
  assert.deepEqual(state.scene.presentCharacterIds, []);
  assert.equal(state.version, 1);
});

test("heuristic extraction cites real message ids and produces facts, threads and episodes", () => {
  const messages = inputs([
    ["m1", "assistant", "Iris perdió la visión del ojo izquierdo durante el incendio."],
    ["m2", "user", "Debemos abrir el sarcófago antes del amanecer."],
    ["m3", "assistant", "Daren confesó que traicionó al gremio en la taberna."],
  ]);
  const draft = extractWithHeuristics(messages);
  assert.ok(draft.facts.length >= 1, "expected at least one fact");
  assert.ok(draft.facts.every((fact) => fact.evidenceMessageIds.every((id) => ["m1", "m2", "m3"].includes(id))));
  assert.ok(draft.threads.some((thread) => thread.kind === "promise" || thread.kind === "secret" || thread.kind === "goal"));
  assert.ok(draft.episodes.some((episode) => episode.summary.includes("confesó")));
  assert.equal(draft.scene?.evidenceMessageIds?.length, 1);
});

test("validator rejects items without evidence and clamps bad numbers", () => {
  const { draft, warnings } = validateExtractionDraft(
    {
      facts: [
        { subject: "Iris", predicate: "perdió", object: "el ojo izquierdo", evidenceMessageIds: ["m1"] },
        { subject: "Fantasma", predicate: "dice", object: "algo", evidenceMessageIds: ["inventado"] },
        { subject: "Sin", predicate: "evidencia", object: "nada" },
      ],
      threads: [{ title: "¿Quién robó la llave?", kind: "question", evidenceMessageIds: ["m2"], priority: 99 }],
      episodes: [],
    },
    ["m1", "m2"],
  );
  assert.equal(draft.facts.length, 1);
  assert.equal(draft.threads.length, 1);
  assert.equal(draft.threads[0].priority, 5);
  assert.ok(warnings.join(" ").includes("Rejected 2"));
});

test("applying an extraction closes a superseded fact instead of deleting it", () => {
  const state = createDefaultActiveMemoryState();
  const first = extractActiveMemory({
    messages: inputs([["m1", "assistant", "Daren tiene la llave plateada."]]),
    state,
  });
  return first.then((extraction) => {
    applyExtractionDraft(state, extraction, { idFactory: () => "fact-1" });
    assert.equal(state.facts.length, 1);
    assert.equal(state.facts[0].validUntilMessageId, undefined);

    const second = extractActiveMemory({
      messages: inputs([["m2", "assistant", "Daren tiene el sello de hierro."]]),
      state,
    });
    return second.then((nextExtraction) => {
      const report = applyExtractionDraft(state, nextExtraction, { idFactory: () => "fact-2" });
      const superseded = state.facts[0];
      assert.equal(superseded.validUntilMessageId, "m2");
      assert.equal(superseded.status, "disputed");
      assert.equal(state.facts.length, 2, "the older version is kept for history");
      assert.ok(report.addedFacts >= 1);
    });
  });
});

test("a fact hidden from a responder is never retrieved, but a public fact is", () => {
  const state = createDefaultActiveMemoryState();
  state.facts.push({
    id: "f1",
    subject: "Iris",
    predicate: "robó",
    object: "la llave",
    status: "confirmed",
    confidence: 0.9,
    importance: 0.9,
    visibleTo: ["Elena"],
    evidenceMessageIds: ["m1"],
    validFromMessageId: "m1",
    entityIds: [],
    createdAt: 1,
    updatedAt: 1,
  });
  state.facts.push({
    id: "f2",
    subject: "Daren",
    predicate: "prometió",
    object: "no usar magia de sangre",
    status: "confirmed",
    confidence: 0.9,
    importance: 0.9,
    visibleTo: "all",
    evidenceMessageIds: ["m2"],
    validFromMessageId: "m2",
    entityIds: [],
    createdAt: 2,
    updatedAt: 2,
  });

  const forGuard = retrieveActiveMemory(state, { responderId: "guardia" });
  assert.deepEqual(forGuard.items.map((item) => item.id), ["f2"]);

  const forElena = retrieveActiveMemory(state, { responderId: "Elena" });
  assert.deepEqual(forElena.items.map((item) => item.id).sort(), ["f1", "f2"]);
});

test("invalidated facts and resolved threads stay out of the brief", () => {
  const state = createDefaultActiveMemoryState();
  state.scene.location = "Cripta del monasterio";
  state.scene.presentCharacterIds = ["Iris"];
  state.facts.push({
    id: "f1",
    subject: "Iris",
    predicate: "es",
    object: "una elfa",
    status: "invalidated",
    confidence: 1,
    importance: 1,
    visibleTo: "all",
    evidenceMessageIds: ["m1"],
    validFromMessageId: "m1",
    entityIds: [],
    createdAt: 1,
    updatedAt: 1,
  });
  state.threads.push({
    id: "t1",
    title: "Iris prometió volver al monasterio",
    kind: "promise",
    status: "open",
    participantIds: ["Iris"],
    evidenceMessageIds: ["m1"],
    priority: 0.9,
    lastMentionedAt: 3,
  });

  const { brief, trace } = compileActiveMemoryBrief(state, { query: "¿Qué dijo Iris sobre el monasterio?" });
  assert.ok(brief.startsWith("[ACTIVE MEMORY"));
  assert.ok(brief.includes("Cripta del monasterio"));
  assert.ok(brief.includes("Iris prometió volver al monasterio"));
  assert.ok(!brief.includes("una elfa"), "invalidated facts must not be injected");
  assert.ok(trace.selected.some((item) => item.id === "t1"));
  assert.ok(trace.selected.every((item) => item.id !== "f1"));
});

test("the brief respects its character budget", () => {
  const state = createDefaultActiveMemoryState();
  state.settings.maxBriefCharacters = 500;
  state.settings.maxBriefItems = 50;
  for (let index = 0; index < 40; index += 1) {
    state.facts.push({
      id: `f${index}`,
      subject: `Personaje${index}`,
      predicate: "recuerda",
      object: "un detalle extremadamente largo que ocupa mucho espacio en el prompt".repeat(3),
      status: "confirmed",
      confidence: 1,
      importance: 1,
      visibleTo: "all",
      evidenceMessageIds: ["m1"],
      validFromMessageId: "m1",
      entityIds: [],
      createdAt: index,
      updatedAt: index,
    });
  }
  const { brief } = compileActiveMemoryBrief(state, { query: "Personaje7" });
  assert.ok(brief.length <= 500, `brief was ${brief.length} characters`);
  assert.ok(brief.endsWith("[/ACTIVE MEMORY]"));
});

test("disabling memory yields an empty brief so generation stays unchanged", () => {
  const state = createDefaultActiveMemoryState();
  state.settings.enabled = false;
  state.scene.location = "Cripta";
  const { brief, trace } = compileActiveMemoryBrief(state, {});
  assert.equal(brief, "");
  assert.equal(trace.selected.length, 0);
});

test("an enabled but empty ledger also injects nothing", () => {
  const state = createDefaultActiveMemoryState();
  const { brief, trace } = compileActiveMemoryBrief(state, { query: "hola" });
  assert.equal(brief, "", "an empty [ACTIVE MEMORY] shell would still cost tokens and say nothing");
  assert.equal(trace.selected.length, 0);
});

test("a scene moved with a movement verb still yields a location", () => {
  const draft = extractWithHeuristics(
    inputs([["m1", "user", "Caminamos hacia la Cripta del monasterio al anochecer."]]),
  );
  assert.equal(draft.scene?.location, "Cripta del monasterio al anochecer");
});

test("sentence-initial prose is not treated as a character name", () => {
  const draft = extractWithHeuristics(
    inputs([
      ["m1", "assistant", "Andamos por el corredor número uno."],
      ["m2", "assistant", "Andamos por el corredor número dos."],
      ["m3", "assistant", "Iris guardó el mapa en el forro del abrigo."],
      ["m4", "assistant", "El guardián miró a Iris sin decir nada."],
    ]),
  );
  const present = draft.scene?.presentCharacterIds ?? [];
  assert.ok(!present.includes("Andamos"), "a sentence-initial verb repeated twice is still not a name");
  assert.ok(present.includes("Iris"), "a name that also appears mid-sentence is kept");
});

test("chat-known names survive even when they only open sentences", () => {
  const draft = extractWithHeuristics(
    inputs([["m1", "assistant", "Daren prometió no volver a usar magia de sangre."]]),
    { knownNames: ["Daren"] },
  );
  assert.ok((draft.scene?.presentCharacterIds ?? []).includes("Daren"));
});

test("LLM extraction failures fall back to heuristics and report a warning", async () => {
  const state = createDefaultActiveMemoryState();
  state.settings.extractionMode = "llm";
  const result = await extractActiveMemory({
    messages: inputs([["m1", "assistant", "Iris tiene el mapa del monasterio."]]),
    state,
    complete: async () => {
      throw new Error("provider down");
    },
  });
  assert.equal(result.report.method, "heuristic-fallback");
  assert.ok(result.report.warnings[0].includes("provider down"));
  assert.ok(result.draft.facts.length >= 1);
});

test("an LLM payload citing unknown message ids is dropped, not trusted", async () => {
  const state = createDefaultActiveMemoryState();
  state.settings.extractionMode = "llm";
  const result = await extractActiveMemory({
    messages: inputs([["m1", "assistant", "Nada relevante."]]),
    state,
    complete: async () => ({
      content: JSON.stringify({
        facts: [{ subject: "Iris", predicate: "es", object: "una elfa", evidenceMessageIds: ["m999"] }],
        threads: [],
        episodes: [],
      }),
      provider: "openai",
      model: "test-model",
      usage: { inputTokens: 1, outputTokens: 1, reasoningTokens: 0, cachedTokens: 0, totalTokens: 2, costUsd: 0 },
    }),
  });
  assert.equal(result.draft.facts.length, 0);
  assert.ok(result.report.warnings.join(" ").includes("Rejected 1"));
});

test("the store persists, versions and rolls back per chat", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "active-memory-"));
  try {
    let counter = 0;
    const store = createActiveMemoryStore({ dataDir: dir, idFactory: () => `id-${++counter}`, now: () => 1_000 });
    const fresh = await store.get("chat-a");
    assert.equal(fresh.facts.length, 0);

    await store.transaction("chat-a", (draft) => {
      draft.scene.location = "Cripta";
    }, { revision: { source: "extraction", summary: "first pass" } });

    const reloaded = await store.get("chat-a");
    assert.equal(reloaded.scene.location, "Cripta");
    assert.equal(reloaded.revisions.length, 1);

    await store.transaction("chat-a", (draft) => {
      draft.scene.location = "Biblioteca";
    }, { revision: { source: "extraction", summary: "second pass" } });
    assert.equal((await store.get("chat-a")).scene.location, "Biblioteca");

    const rolled = await store.rollback("chat-a");
    assert.equal(rolled?.scene.location, "Cripta");

    // An unrelated chat must never see another chat's memory.
    assert.equal((await store.get("chat-b")).scene.location, undefined);

    assert.equal(await store.remove("chat-a"), true);
    assert.equal(await store.remove("chat-a"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a no-op transaction does not create a revision or rewrite the file", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "active-memory-"));
  try {
    const store = createActiveMemoryStore({ dataDir: dir });
    await store.transaction("chat-a", () => undefined, { revision: { source: "extraction", summary: "noop" } });
    assert.equal((await store.peek("chat-a")), null, "nothing changed, so nothing was written");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("concurrent store writes for one chat are serialized", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "active-memory-"));
  try {
    const store = createActiveMemoryStore({ dataDir: dir });
    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        store.transaction("chat-a", (draft) => {
          draft.scene.relevantObjects.push(`objeto-${index}`);
        }),
      ),
    );
    assert.equal((await store.get("chat-a")).scene.relevantObjects.length, 10);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("facts resolve entityIds against the chat entity map, falling back to the subject name", async () => {
  const withMap = createDefaultActiveMemoryState();
  const extraction = await extractActiveMemory({
    messages: inputs([["m1", "assistant", "Daren tiene la llave plateada."]]),
    state: withMap,
    entities: [{ id: "npc-daren", name: "Daren" }],
  });
  applyExtractionDraft(withMap, extraction, { idFactory: () => "fact-1" });
  assert.deepEqual(withMap.facts[0].entityIds, ["npc-daren"]);

  const withoutMap = createDefaultActiveMemoryState();
  const plain = await extractActiveMemory({
    messages: inputs([["m1", "assistant", "Daren tiene la llave plateada."]]),
    state: withoutMap,
  });
  applyExtractionDraft(withoutMap, plain, { idFactory: () => "fact-1" });
  assert.deepEqual(withoutMap.facts[0].entityIds, ["Daren"], "without a map the subject name is the best identity available");

  // A fact about two known entities keeps both ids, so either of them can retrieve it later.
  const both = createDefaultActiveMemoryState();
  const twoEntities = await extractActiveMemory({
    messages: inputs([["m1", "assistant", "Daren conoce a Iris desde la infancia."]]),
    state: both,
    entities: [
      { id: "npc-daren", name: "Daren" },
      { id: "npc-iris", name: "Iris" },
    ],
  });
  applyExtractionDraft(both, twoEntities, { idFactory: () => "fact-1" });
  assert.deepEqual(both.facts[0].entityIds.sort(), ["npc-daren", "npc-iris"]);
});

test("a causally linked item earns +3 and says so in its reasons", () => {
  const state = createDefaultActiveMemoryState();
  state.settings.maxBriefItems = 10;
  state.scene.presentCharacterIds = ["npc-daren"];
  state.facts = [
    memoryFact({ id: "f1", subject: "Daren", predicate: "prometió", object: "volver al monasterio", entityIds: ["npc-daren"], importance: 1, evidenceMessageIds: ["m9"] }),
    memoryFact({ id: "f2", subject: "Iris", predicate: "guardó", object: "el mapa", importance: 0.2, evidenceMessageIds: ["m1"] }),
    memoryFact({ id: "f3", subject: "La puerta", predicate: "es", object: "de hierro", importance: 0.1, evidenceMessageIds: ["m1"] }),
  ];
  const { trace } = compileActiveMemoryBrief(state, { now: () => 1 });

  const anchored = trace.selected.find((item) => item.id === "f1");
  assert.ok(anchored?.reasons.includes("causal link"), "an item anchored to an entity on stage is causally linked");
  // f2 does not cite anything already selected when it lands, f3 cites f2's message and does.
  const first = trace.selected.find((item) => item.id === "f2");
  assert.ok(!first?.reasons.includes("causal link"), "the first item citing a message cannot be linked to itself");
  const linked = trace.selected.find((item) => item.id === "f3");
  assert.ok(linked?.reasons.includes("causal link"), "sharing an evidence message with a selected item is a causal link");
  assert.ok((linked?.score ?? 0) > (first?.score ?? 0), "the +3 is part of the reported score");
});

test("the relative budget shrinks the brief when the context window is small", () => {
  const state = createDefaultActiveMemoryState();
  state.settings.maxBriefItems = 50;
  for (let index = 0; index < 40; index += 1) {
    state.facts.push(
      memoryFact({
        id: `f${index}`,
        subject: `Personaje${index}`,
        predicate: "recuerda",
        object: "un detalle extremadamente largo que ocupa mucho espacio en el prompt".repeat(3),
        importance: 1,
      }),
    );
  }
  // 10% of 4096 tokens, rounded to 410 tokens, at 4 characters per token.
  assert.equal(resolveBriefCharacterBudget(state, { maxContextTokens: 4_096 }), 1_640);
  assert.equal(resolveBriefCharacterBudget(state), state.settings.maxBriefCharacters, "without a context window the fixed budget is unchanged");
  assert.equal(resolveBriefCharacterBudget({ ...state, settings: { ...state.settings, relateBudgetToContext: false } }, { maxContextTokens: 4_096 }), state.settings.maxBriefCharacters);

  const relative = compileActiveMemoryBrief(state, { query: "Personaje7", maxContextTokens: 4_096 });
  const fixed = compileActiveMemoryBrief(state, { query: "Personaje7" });
  assert.ok(relative.brief.length <= 1_640, `relative brief was ${relative.brief.length} characters`);
  assert.ok(relative.brief.length < fixed.brief.length, "a 4k window gets a smaller brief than the fixed default");
  assert.ok(fixed.brief.length <= state.settings.maxBriefCharacters);
  assert.ok(relative.brief.endsWith("[/ACTIVE MEMORY]"));
});

test("the stored trace is only replaced when the brief actually changes", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "active-memory-"));
  try {
    const store = createActiveMemoryStore({ dataDir: dir, now: () => 1_000 });
    const state = createDefaultActiveMemoryState();
    state.facts = [memoryFact({ id: "f1", subject: "Daren", predicate: "tiene", object: "la llave plateada" })];

    const first = compileActiveMemoryBrief(state, { query: "llave", now: () => 7 });
    assert.equal(commitBriefTrace(state, first.trace), true);
    await store.transaction("chat-a", (draft) => {
      draft.lastBrief = first.trace;
    });
    assert.equal((await store.peek("chat-a"))?.lastBrief?.generatedAt, 7);

    const unchanged = compileActiveMemoryBrief(state, { query: "llave", now: () => 9 });
    assert.equal(commitBriefTrace(state, unchanged.trace), false);
    assert.equal(state.lastBrief?.generatedAt, 7, "an unchanged brief keeps the previous trace");
    await store.transaction("chat-a", (draft) => {
      commitBriefTrace(draft, unchanged.trace);
    });
    assert.equal((await store.peek("chat-a"))?.lastBrief?.generatedAt, 7, "a no-op trace never rewrites the ledger");

    state.facts[0].object = "el sello de hierro";
    const changed = compileActiveMemoryBrief(state, { query: "llave", now: () => 11 });
    assert.equal(commitBriefTrace(state, changed.trace), true, "a different brief replaces the trace");
    assert.equal(state.lastBrief?.generatedAt, 11);

    // Selecting a different set of items is material even if the rendered text happens to match.
    const other = { ...changed.trace, selected: [], brief: changed.trace.brief };
    assert.equal(commitBriefTrace(state, other), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("invalidating evidence flags facts and threads and drops fully invalidated episodes", () => {
  const state = createDefaultActiveMemoryState();
  state.facts = [
    memoryFact({ id: "f1", subject: "Iris", predicate: "guardó", object: "el mapa", evidenceMessageIds: ["m1", "m5"] }),
    memoryFact({ id: "f2", subject: "Daren", predicate: "tiene", object: "la llave", evidenceMessageIds: ["m3"] }),
  ];
  state.threads = [
    memoryThread({ id: "t1", title: "Iris prometió volver", evidenceMessageIds: ["m1"] }),
    memoryThread({ id: "t2", title: "Daren busca el sello", evidenceMessageIds: ["m3"] }),
  ];
  state.episodes = [
    memoryEpisode({ id: "e1", summary: "Iris escapó de la cripta", sourceMessageIds: ["m1"] }),
    memoryEpisode({ id: "e2", summary: "Daren confesó en la taberna", sourceMessageIds: ["m1", "m2"] }),
  ];
  state.lastProcessedMessageId = "m4";

  const report = invalidateMemoryEvidence(state, ["m1"], {
    reason: "message edited",
    chatMessageIds: ["m0", "m1", "m2", "m3", "m4"],
  });

  assert.equal(report.factsMarkedForReview, 1);
  assert.equal(report.threadsMarkedForReview, 1);
  assert.equal(report.episodesRemoved, 1);
  assert.equal(report.rewoundToMessageId, "m0");
  assert.equal(report.reason, "message edited");
  assert.deepEqual(report.messageIds, ["m1"]);
  assert.equal(state.facts[0].needsReview, true);
  assert.equal(state.facts[1].needsReview, undefined);
  assert.equal(state.threads[0].needsReview, true);
  assert.equal(state.threads[1].needsReview, undefined);
  assert.deepEqual(state.episodes.map((episode) => episode.id), ["e2"]);
  assert.equal(state.lastProcessedMessageId, "m0", "the next extraction re-reads the zone that was invalidated");

  // A message that is not part of the chat cannot rewind anything.
  const untouched = invalidateMemoryEvidence(state, ["desconocido"], { chatMessageIds: ["m0", "m1"] });
  assert.equal(untouched.rewoundToMessageId, undefined);
  assert.equal(state.lastProcessedMessageId, "m0");

  // Invaliding the very first message clears the cursor so the next pass starts over.
  const fromStart = invalidateMemoryEvidence(state, ["m0"], { chatMessageIds: ["m0", "m1"] });
  assert.equal(fromStart.rewoundToMessageId, undefined);
  assert.equal(state.lastProcessedMessageId, undefined);
});

test("merging duplicates unifies evidence and keeps the stronger pin and confidence", () => {
  const state = createDefaultActiveMemoryState();
  state.facts = [
    memoryFact({ id: "f1", subject: "Daren", predicate: "tiene", object: "la llave", confidence: 0.4, importance: 0.3, evidenceMessageIds: ["m1"], entityIds: ["npc-daren"] }),
    memoryFact({ id: "f2", subject: "Daren", predicate: "tiene", object: "la llave plateada", confidence: 0.95, importance: 0.9, evidenceMessageIds: ["m2"], entityIds: ["npc-iris"], pinned: true }),
  ];
  state.threads = [
    memoryThread({ id: "t1", title: "Iris prometió volver", evidenceMessageIds: ["m1"], participantIds: ["Iris"], priority: 0.4 }),
    memoryThread({ id: "t2", title: "Iris prometió regresar", evidenceMessageIds: ["m2"], participantIds: ["Daren"], priority: 0.9, pinned: true, needsReview: true }),
  ];

  assert.equal(mergeMemoryItems(state, "fact" as MemoryItemType, "f1", "f2").ok, true);
  assert.equal(state.facts.length, 1);
  const keep = state.facts[0];
  assert.deepEqual(keep.evidenceMessageIds, ["m1", "m2"]);
  assert.deepEqual(keep.entityIds, ["npc-daren", "npc-iris"]);
  assert.equal(keep.confidence, 0.95);
  assert.equal(keep.importance, 0.9);
  assert.equal(keep.pinned, true);

  assert.equal(mergeMemoryItems(state, "thread", "t1", "t2").ok, true);
  assert.equal(state.threads.length, 1);
  assert.deepEqual(state.threads[0].evidenceMessageIds, ["m1", "m2"]);
  assert.deepEqual(state.threads[0].participantIds, ["Iris", "Daren"]);
  assert.equal(state.threads[0].priority, 0.9);
  assert.equal(state.threads[0].pinned, true);
  assert.equal(state.threads[0].needsReview, true);

  const missing = mergeMemoryItems(state, "fact", "f1", "fantasma");
  assert.equal(missing.ok, false);
  assert.equal(missing.ok === false && missing.status, 404);
  const badTarget = mergeMemoryItems(state, "saga" as MemoryItemType, "f1", "f1");
  assert.equal(badTarget.ok === false && badTarget.status, 400);
  const sameId = mergeMemoryItems(state, "fact", "f1", "f1");
  assert.equal(sameId.ok === false && sameId.status, 400);
  const empty = mergeMemoryItems(state, "fact", "", "f1");
  assert.equal(empty.ok === false && empty.status, 400);
});

test("settings and item patches accept the documented fields and ignore unknown ones", () => {
  const state = createDefaultActiveMemoryState();
  state.settings = applySettingsPatch(state.settings, {
    enabled: false,
    model: "cheap-model",
    extractionMode: "llm",
    maxFacts: 99.6,
    maxThreads: 4,
    maxEpisodes: 2,
    maxBriefItems: 8,
    maxBriefCharacters: 10,
    briefBudgetPercent: 999,
    relateBudgetToContext: false,
    deferVisualFactsToDirector: false,
    semantic: { enabled: true, model: "emb", minScore: 5 },
    scope: { mode: "shared", key: "my world!!" },
    nonsense: true,
  });
  assert.equal(state.settings.enabled, false);
  assert.equal(state.settings.model, "cheap-model");
  assert.equal(state.settings.extractionMode, "llm");
  assert.equal(state.settings.maxFacts, 100);
  assert.equal(state.settings.maxThreads, 4);
  assert.equal(state.settings.maxEpisodes, 2);
  assert.equal(state.settings.maxBriefItems, 8);
  assert.equal(state.settings.maxBriefCharacters, 500, "clamped to the compiler floor");
  assert.equal(state.settings.briefBudgetPercent, 50);
  assert.equal(state.settings.relateBudgetToContext, false);
  assert.equal(state.settings.deferVisualFactsToDirector, false);
  assert.deepEqual(state.settings.semantic, { enabled: true, model: "emb", minScore: 1 });
  assert.deepEqual(state.settings.scope, { mode: "shared", key: "my_world__" });
  assert.equal("nonsense" in state.settings, false, "unknown keys are ignored, not stored");

  const kept = applySettingsPatch(state.settings, { extractionMode: "magic", enabled: "yes", maxFacts: "muchos" });
  assert.equal(kept.extractionMode, "llm");
  assert.equal(kept.enabled, false);
  assert.equal(kept.maxFacts, 100);

  const fact = memoryFact({ id: "f1", subject: "Iris", predicate: "guardó", object: "el mapa" });
  state.facts = [fact];
  assert.equal(patchMemoryItem(state, "fact", "f1", { visibleTo: ["Elena"], needsReview: true, unknown: 1 }), true);
  assert.deepEqual(fact.visibleTo, ["Elena"]);
  assert.equal(fact.needsReview, true);
  assert.equal(patchMemoryItem(state, "fact", "f1", { needsReview: false }), true);
  assert.equal(fact.needsReview, undefined);
  assert.equal(patchMemoryItem(state, "fact", "f1", { visibleTo: [] }), true);
  assert.deepEqual(fact.visibleTo, ["Elena"], "an empty visibility list is a mistake, not an edit");
  assert.equal(patchMemoryItem(state, "fact", "f1", { visibleTo: "all" }), true);
  assert.equal(fact.visibleTo, "all");
  assert.equal(patchMemoryItem(state, "fact", "fantasma", { pinned: true }), false);

  const thread = memoryThread({ id: "t1", title: "Iris prometió volver" });
  state.threads = [thread];
  assert.equal(patchMemoryItem(state, "thread", "t1", { status: "resolved", pinned: true, title: "Iris cumplió su promesa" }), true);
  assert.equal(thread.status, "resolved");
  assert.equal(thread.pinned, true);
  assert.equal(thread.title, "Iris cumplió su promesa");
  assert.equal(patchMemoryItem(state, "thread", "t1", { status: "imposible" }), true);
  assert.equal(thread.status, "resolved", "an invalid status leaves the previous one");
});

test("visual facts are deferred to Image Director when the setting is on", async () => {
  const deferred = createDefaultActiveMemoryState();
  assert.equal(deferred.settings.deferVisualFactsToDirector, true);
  const left = await extractActiveMemory({
    messages: inputs([["m1", "assistant", "Daren tiene un abrigo azul."]]),
    state: deferred,
  });
  assert.equal(left.draft.facts.length, 0, "outfit facts belong to the visual ledger");

  const kept = createDefaultActiveMemoryState();
  kept.settings.deferVisualFactsToDirector = false;
  const right = await extractActiveMemory({
    messages: inputs([["m1", "assistant", "Daren tiene un abrigo azul."]]),
    state: kept,
  });
  assert.equal(right.draft.facts.length, 1, "turning the setting off keeps the old behaviour");

  const heuristic = extractWithHeuristics(
    inputs([["m1", "assistant", "Iris lleva una armadura negra."]]),
    { deferVisualFactsToDirector: true },
  );
  assert.equal(heuristic.facts.length, 0);
  const injury = extractWithHeuristics(
    inputs([["m1", "assistant", "Iris perdió la visión del ojo izquierdo."]]),
    { deferVisualFactsToDirector: true },
  );
  assert.ok(injury.facts.length >= 1, "injuries and senses are canon, not appearance");
});

test("a shared scope lets one chat see another chat's canon, and a private chat does not", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "active-memory-"));
  try {
    const store = createActiveMemoryStore({ dataDir: path.join(dir, "chat"), now: () => 1_000 });
    const ledgers = createSharedLedgerStore({ dataDir: path.join(dir, "shared") });

    // Chat A records canon and publishes it under the world key.
    await store.transaction("chat-a", (draft) => {
      draft.settings.scope = { mode: "shared", key: "world-1" };
      draft.facts.push(memoryFact({ id: "fa", subject: "Daren", predicate: "tiene", object: "la llave plateada" }));
    });
    const localA = await store.get("chat-a");
    assert.equal(scopeIsShared(localA.settings.scope), true);
    await ledgers.write("world-1", publishToSharedLedger(localA, null));

    // Chat B shares the key: it sees A's fact even though its own ledger is empty.
    const localB = await store.get("chat-b");
    assert.equal(scopeIsShared(localB.settings.scope), false, "a private chat never reads the shared ledger");
    assert.equal(scopeIsShared({ mode: "chat", key: "world-1" }), false);
    const shared = await ledgers.read("world-1");
    const mergedB = mergeSharedLedger(localB, shared);
    assert.deepEqual(mergedB.facts.map((fact) => fact.object), ["la llave plateada"]);
    assert.equal(mergedB.addedFromShared, 1);
    assert.equal((await store.get("chat-b")).facts.length, 0, "reading a shared ledger never writes into the chat");

    // Chat B records its own version of the same fact: the local canon wins over the shared one.
    await store.transaction("chat-b", (draft) => {
      draft.facts.push(memoryFact({ id: "fb", subject: "Daren", predicate: "tiene", object: "la llave plateada", importance: 0.95 }));
    });
    const localB2 = await store.get("chat-b");
    const mergedAgain = mergeSharedLedger(localB2, shared);
    assert.equal(mergedAgain.addedFromShared, 0, "the shared duplicate does not overwrite the chat's own fact");
    assert.equal(mergedAgain.facts.length, 1);
    assert.equal(mergedAgain.facts[0].id, "fb");
    assert.equal(mergedAgain.facts[0].importance, 0.95);

    // Publishing B's canon keeps the shared key unique and lets B's local version win.
    await ledgers.write("world-1", publishToSharedLedger(localB2, shared));
    const republished = await ledgers.read("world-1");
    assert.equal(republished?.facts.length, 1);
    assert.equal(republished?.facts[0].id, "fb");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

/**
 * The heuristic extractor is bilingual on purpose: a chat written in English must be remembered as
 * well as one written in Spanish. These four checks are the ones that used to fail in English —
 * the term lists behind them were Spanish-only, so episodes were never promoted, inner monologue
 * read as action, and outfit facts reached the ledger while Image Director tracked them separately.
 */
test("the heuristic extractor treats English prose like Spanish prose", async () => {
  const episodesOf = async (entries: Array<[string, string, string]>) => {
    const state = createDefaultActiveMemoryState();
    const extraction = await extractActiveMemory({ messages: inputs(entries), state, mode: "heuristic" });
    return extraction.draft;
  };

  const english = await episodesOf([
    ["m1", "assistant", "Iris finally opened the sarcophagus and found the silver key."],
    ["m2", "assistant", "Daren died in the crypt after the fight."],
    ["m3", "user", "We left the monastery at dawn."],
    ["m4", "assistant", "Daren wears a blue coat now."],
  ]);
  const spanish = await episodesOf([
    ["m1", "assistant", "Iris finalmente abrió el sarcófago y encontró la llave plateada."],
    ["m2", "assistant", "Daren murió en la cripta después de la pelea."],
    ["m3", "user", "Salimos del monasterio al amanecer."],
    ["m4", "assistant", "Daren lleva un abrigo azul ahora."],
  ]);

  assert.equal(english.episodes.length, 2, "a completion marker plus a change verb promotes an episode");
  assert.equal(spanish.episodes.length, english.episodes.length, "English keeps parity with Spanish");
  assert.equal(english.facts.length, 0, "the outfit fact is deferred to Image Director, not stored as canon");
  assert.equal(spanish.facts.length, english.facts.length);

  const thoughtEnglish = segmentLine("*I think they are lying to us.*", "m1", "user").map((beat) => beat.kind);
  const thoughtSpanish = segmentLine("*Creo que nos están mintiendo.*", "m1", "user").map((beat) => beat.kind);
  assert.deepEqual(thoughtEnglish, ["thought"]);
  assert.deepEqual(thoughtSpanish, thoughtEnglish);

  assert.ok(describesVisualAppearance("Daren", "wears", "a blue coat"));
  assert.ok(describesVisualAppearance("Daren", "lleva", "un abrigo azul"));

  const location = await episodesOf([["m1", "assistant", "We walked toward the monastery crypt at dusk."]]);
  assert.equal(location.scene?.location, "monastery crypt at dusk", "the preposition does not eat the word");
});
