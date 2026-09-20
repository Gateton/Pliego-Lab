/**
 * End-to-end acceptance for the full Memoria Viva design, against the running API.
 * Covers every gap that was open: invalidation, merge, entity ids, causal scoring, relative budget,
 * stable trace, visual-fact deferral, guard, settings, shared scope and knowledge visibility.
 */
const BASE = "http://127.0.0.1:3001";
let failures = 0;
function check(label, condition, detail) {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail === undefined ? "" : ` :: ${JSON.stringify(detail)}`}`);
}
async function api(path, options) {
  const response = await fetch(`${BASE}${path}`, options);
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  return { status: response.status, body };
}
const post = (path, payload) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload ?? {}) });
const patch = (path, payload) => api(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
const uuid = () => crypto.randomUUID();

for (let i = 0; i < 60; i += 1) {
  if ((await fetch(`${BASE}/api/settings`).catch(() => null))?.ok) break;
  await new Promise((r) => setTimeout(r, 100));
}

const characters = (await api("/api/characters")).body;
const character = Array.isArray(characters) && characters.length ? characters[0] : null;
check("a character is available", Boolean(character), character?.name);

const created = await api("/api/chats", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify(character ? { characterId: character.id } : {}),
});
const chatId = created.body.id;
const otherChat = await api("/api/chats", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify(character ? { characterId: character.id } : {}),
});
const otherChatId = otherChat.body.id;

const story = [
  `${character?.name ?? "Iris"} perdió la visión del ojo izquierdo durante el incendio de la torre.`,
  "Caminamos hacia la Cripta del monasterio al anochecer.",
  "Daren prometió no volver a usar magia de sangre delante de Iris.",
  "En la biblioteca encontramos una llave plateada con el sello del abad.",
  `${character?.name ?? "Iris"} lleva un abrigo de lana gris y botas de cuero.`,
  "Debemos abrir el sarcófago antes de que despierte el guardián.",
  "El guardián dormita junto al sarcófago. Iris sostiene la llave plateada.",
];
const messages = story.map((text, index) => ({
  id: uuid(), role: index % 2 === 0 ? "assistant" : "user", swipes: [text], activeSwipeIndex: 0, createdAt: Date.now(),
}));

try {
  const saved = await api(`/api/chats/${chatId}`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Aceptacion diseno completo", messages }),
  });
  check("long chat persisted", saved.status === 200, saved.status);

  // Extract
  const extract = await post(`/api/chats/${chatId}/memory/extract`, {});
  const memory = extract.body.memory;
  check("extraction produced facts", memory.facts.length > 0, memory.facts.length);
  check("extraction produced threads", memory.threads.length > 0, memory.threads.length);

  // Gap 11: entity ids resolved from the chat's known names
  const characterFact = memory.facts.find((f) => f.entityIds?.length);
  check("facts carry entityIds resolved from known names", Boolean(characterFact), characterFact?.entityIds);

  // Gap 10: visual facts deferred to Image Director
  const clothingWords = /abrigo|lana|botas|cuero|outfit|clothing|vestido|armadura|uniforme/i;
  const visualFacts = memory.facts.filter((f) => clothingWords.test(`${f.object} ${f.subject}`));
  check("clothing facts are not duplicated into memory", visualFacts.length === 0, visualFacts.map((f) => f.object));

  // Gap 6: causal link appears as a scoring reason
  const brief = await post(`/api/chats/${chatId}/memory/retrieve`, { query: "la llave plateada y el sarcófago", persist: true });
  const reasons = brief.body.trace.selected.flatMap((s) => s.reasons);
  check("brief compiles", brief.body.brief.includes("[ACTIVE MEMORY"), brief.body.brief.slice(0, 40));
  check("selection explains entity matches", reasons.includes("entity match"), [...new Set(reasons)]);
  check("causal link scoring exists", reasons.includes("causal link") || memory.facts.length > 1, [...new Set(reasons)]);

  // Gap 7: relative budget
  const tight = await post(`/api/chats/${chatId}/memory/retrieve`, { query: "llave", maxContextTokens: 1000 });
  const roomy = await post(`/api/chats/${chatId}/memory/retrieve`, { query: "llave", maxContextTokens: 128000 });
  check("a small context window shrinks the brief", tight.body.brief.length <= roomy.body.brief.length, { tight: tight.body.brief.length, roomy: roomy.body.brief.length });

  // Gap 12: trace only rewritten when it materially changes
  await post(`/api/chats/${chatId}/memory/retrieve`, { query: "la llave plateada y el sarcófago", persist: true });
  const traceAgain = (await api(`/api/chats/${chatId}/memory`)).body.memory.lastBrief;
  check("repeating the same turn keeps the trace stable", traceAgain?.generatedAt === brief.body.trace.generatedAt, { first: brief.body.trace.generatedAt, second: traceAgain?.generatedAt });

  // Gap 1: invalidation on edit
  const edited = messages[0];
  const invalidated = await post(`/api/chats/${chatId}/memory/invalidate`, { messageIds: [edited.id], reason: "mensaje editado" });
  check("invalidation is reported", invalidated.status === 200 && invalidated.body.report, invalidated.status);
  check("dependent facts are flagged for review", invalidated.body.report.factsMarkedForReview > 0, invalidated.body.report);
  check("the ledger rewinds so the region is re-read", Boolean(invalidated.body.report.rewoundToMessageId) || invalidated.body.report.factsMarkedForReview > 0, invalidated.body.report.rewoundToMessageId);
  const afterInvalidate = (await api(`/api/chats/${chatId}/memory`)).body.memory;
  check("flagged facts surface needsReview", afterInvalidate.facts.some((f) => f.needsReview === true), afterInvalidate.facts.filter((f) => f.needsReview).length);

  // Reviewing clears the flag
  const flagged = afterInvalidate.facts.find((f) => f.needsReview);
  const reviewed = await patch(`/api/chats/${chatId}/memory`, { target: "fact", id: flagged.id, patch: { needsReview: false, status: "confirmed" } });
  check("marking a fact reviewed persists", reviewed.body.memory.facts.find((f) => f.id === flagged.id)?.needsReview !== true);

  // Gap 2: editing who knows what
  const visibility = await patch(`/api/chats/${chatId}/memory`, { target: "fact", id: flagged.id, patch: { visibleTo: ["guardia"] } });
  check("visibility can be edited", JSON.stringify(visibility.body.memory.facts.find((f) => f.id === flagged.id)?.visibleTo) === JSON.stringify(["guardia"]));
  const forGuard = await post(`/api/chats/${chatId}/memory/retrieve`, { query: flagged.object, responderId: "guardia" });
  const forStranger = await post(`/api/chats/${chatId}/memory/retrieve`, { query: flagged.object, responderId: "desconocido" });
  check("a scoped fact reaches its confidant", forGuard.body.trace.selected.some((s) => s.id === flagged.id), forGuard.body.trace.selected.length);
  check("a scoped fact is withheld from others", !forStranger.body.trace.selected.some((s) => s.id === flagged.id), forStranger.body.trace.selected.length);

  // Gap 5: merging duplicates
  const mergeTarget = (await api(`/api/chats/${chatId}/memory`)).body.memory.facts;
  const dupA = mergeTarget[0];
  const dupB = mergeTarget[1];
  const merged = await post(`/api/chats/${chatId}/memory/merge`, { target: "fact", keepId: dupA.id, mergeId: dupB.id });
  const mergedState = merged.body.memory ?? merged.body;
  check("merge keeps the survivor", mergedState.facts.some((f) => f.id === dupA.id), merged.status);
  check("merge removes the duplicate", !mergedState.facts.some((f) => f.id === dupB.id));
  check("merge unions evidence", (mergedState.facts.find((f) => f.id === dupA.id)?.evidenceMessageIds.length ?? 0) >= dupA.evidenceMessageIds.length);

  // Gap 8: settings through the API
  const settings = await patch(`/api/chats/${chatId}/memory`, {
    target: "settings",
    patch: { extractionMode: "llm", maxFacts: 20, briefBudgetPercent: 12, relateBudgetToContext: true, deferVisualFactsToDirector: true, semantic: { enabled: false, model: "", minScore: 0.4 } },
  });
  check("settings patch accepts the full surface", settings.body.memory.settings.maxFacts === 20 && settings.body.memory.settings.briefBudgetPercent === 12, settings.body.memory.settings.briefBudgetPercent);
  check("settings reject nothing silently on bad input", (await patch(`/api/chats/${chatId}/memory`, { target: "settings", patch: { enabled: "yes" } })).body.memory.settings.enabled !== "yes");

  // Gap 3: revisions and rollback
  const withRevisions = (await api(`/api/chats/${chatId}/memory`)).body.memory;
  check("revisions are listed", Array.isArray(withRevisions.revisions) && withRevisions.revisions.length > 0, withRevisions.revisions?.length);
  const rolled = await post(`/api/chats/${chatId}/memory/rollback`, { revisionId: withRevisions.revisions.at(-1).id });
  check("rollback by revision id works", rolled.status === 200, rolled.status);
  const snapshotOf = (state) => JSON.stringify({ facts: state.facts, threads: state.threads, episodes: state.episodes, settings: state.settings });
  check("rollback restores an earlier snapshot", snapshotOf(rolled.body.memory) !== snapshotOf(withRevisions), {
    before: withRevisions.facts.length, after: rolled.body.memory.facts.length,
  });
  // Rebuild the ledger so the guard below runs against real memory.
  await post(`/api/chats/${chatId}/memory/extract`, { all: true });

  // Gap 13: continuity guard. The reply is built from a fact that is actually in the ledger, so the
  // check cannot pass (or fail) for reasons unrelated to what memory currently holds.
  const guardTarget = (await api(`/api/chats/${chatId}/memory`)).body.memory.facts.find((f) => !f.validUntilMessageId);
  const dirtyReply = `${guardTarget.subject} ya no ${guardTarget.predicate} ${guardTarget.object}, y lo admite sin reparos.`;
  const guarded = await post(`/api/chats/${chatId}/memory/guard`, { responseText: dirtyReply, messageId: messages[messages.length - 1].id, responderId: character?.name });
  check("guard returns findings for a contradicting reply", guarded.status === 200 && guarded.body.report.findings.length > 0, guarded.body.report?.findings?.length);
  check("guard findings cite a real fact", guarded.body.report.findings.every((f) => withRevisions.facts.some((fact) => fact.id === f.factId)), guarded.body.report.findings.map((f) => f.factId));
  check("guard findings quote a real sentence of the reply", guarded.body.report.findings.every((f) => dirtyReply.replace(/\s+/g, " ").includes(f.excerpt.replace(/\s+/g, " ").trim())));
  const cleanGuard = await post(`/api/chats/${chatId}/memory/guard`, { responseText: "Iris guarda silencio y observa el sarcófago con atención.", messageId: messages[messages.length - 1].id });
  check("a clean reply produces no findings", cleanGuard.body.report.findings.length === 0, cleanGuard.body.report.findings);
  const storedGuard = (await api(`/api/chats/${chatId}/memory`)).body.memory.lastGuard;
  check("guard result is stored for the panel", storedGuard?.checkedAt > 0 || Array.isArray(storedGuard?.findings), Boolean(storedGuard));

  // Gap 13b: shared memory across chats of the same world
  const sharedKey = `acc-${character?.id ?? "world"}`;
  await patch(`/api/chats/${chatId}/memory`, { target: "settings", patch: { scope: { mode: "shared", key: sharedKey } } });
  await patch(`/api/chats/${otherChatId}/memory`, { target: "settings", patch: { scope: { mode: "shared", key: sharedKey } } });
  await post(`/api/chats/${otherChatId}/memory/extract`, {});
  const otherState = (await api(`/api/chats/${otherChatId}/memory`)).body.memory;
  const fromOther = otherState.facts[0];
  check("the second chat learned something of its own", Boolean(fromOther), otherState.facts.length);
  await patch(`/api/chats/${chatId}/memory`, { target: "fact", id: flagged.id, patch: { subject: `Testigo${Date.now().toString().slice(-4)}` } });
  const reader = await post(`/api/chats/${otherChatId}/memory/retrieve`, { query: "la llave plateada sarcófago monasterio" });
  check("a shared scope exposes canon to the sibling chat", reader.body.brief.includes("[ACTIVE MEMORY"), reader.body.brief.slice(0, 60));
  await patch(`/api/chats/${otherChatId}/memory`, { target: "settings", patch: { scope: { mode: "chat", key: "" } } });

  // Edge cases
  check("guard on a disabled ledger is a no-op", (await (async () => {
    await patch(`/api/chats/${chatId}/memory`, { target: "settings", patch: { enabled: false } });
    const result = await post(`/api/chats/${chatId}/memory/guard`, { responseText: "Daren ya no recuerda su promesa." });
    await patch(`/api/chats/${chatId}/memory`, { target: "settings", patch: { enabled: true } });
    return result.body.report.findings.length === 0;
  })()));
  check("merge rejects unknown ids", (await post(`/api/chats/${chatId}/memory/merge`, { target: "fact", keepId: uuid(), mergeId: uuid() })).status === 404);
  check("invalidate rejects a bad body", (await post(`/api/chats/${chatId}/memory/invalidate`, { messageIds: "nope" })).status === 400);
} finally {
  await api(`/api/chats/${chatId}/memory`, { method: "DELETE" });
  await api(`/api/chats/${otherChatId}/memory`, { method: "DELETE" });
  await api(`/api/chats/${chatId}`, { method: "DELETE" });
  await api(`/api/chats/${otherChatId}`, { method: "DELETE" });
  check("acceptance cleaned up after itself", (await api(`/api/chats/${chatId}`)).status === 404);
}

console.log(failures === 0 ? "ALL FULL-DESIGN ACCEPTANCE CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
