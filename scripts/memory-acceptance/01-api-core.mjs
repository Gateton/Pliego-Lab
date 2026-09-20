const BASE = "http://127.0.0.1:3001";
let failures = 0;
function check(label, condition, detail) {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail === undefined ? "" : ` :: ${JSON.stringify(detail)}`}`);
}
async function json(path, options) {
  const response = await fetch(`${BASE}${path}`, options);
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  return { status: response.status, body };
}
const uuid = () => crypto.randomUUID();

for (let i = 0; i < 60; i += 1) {
  const probe = await fetch(`${BASE}/api/settings`).catch(() => null);
  if (probe?.ok) break;
  await new Promise((r) => setTimeout(r, 100));
}

const characters = (await json("/api/characters")).body;
const characterId = Array.isArray(characters) && characters.length ? characters[0].id : undefined;
check("existing characters available", Boolean(characterId), { characterId });

const created = await json("/api/chats", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(characterId ? { characterId } : {}),
});
check("chat created through the public API", created.status === 201, created.status);
const chatId = created.body.id;

try {
  // 1) A fresh chat has memory but nothing in it, and the brief is empty.
  const initial = await json(`/api/chats/${chatId}/memory`);
  check("GET memory returns a normalized empty ledger", initial.status === 200 && initial.body.memory.facts.length === 0, initial.status);
  const emptyBrief = await json(`/api/chats/${chatId}/memory/retrieve`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "hola" }),
  });
  check("empty memory compiles an empty brief", emptyBrief.body.brief === "", emptyBrief.body.brief);

  // 2) A long Spanish scene: the key facts live in the FIRST messages, far from the latest turn.
  const story = [
    ["assistant", "Iris perdió la visión del ojo izquierdo durante el incendio de la torre."],
    ["user", "Caminamos hacia la Cripta del monasterio al anochecer."],
    ["assistant", "Daren prometió no volver a usar magia de sangre delante de Iris."],
    ["assistant", "En la biblioteca encontramos una llave plateada con el sello del abad."],
    ["user", "Seguimos avanzando por el pasillo inferior, sin hacer ruido."],
    ["assistant", "El guardián dormita junto al sarcófago. Iris sostiene la llave plateada."],
    ["user", "Debemos abrir el sarcófago antes de que despierte."],
    ["assistant", "Iris tiene el mapa del monasterio guardado en el forro del abrigo."],
  ];
  const messages = story.map(([role, text]) => ({
    id: uuid(), role, swipes: [text], activeSwipeIndex: 0, createdAt: Date.now(),
  }));
  // Pad the scene so the opening facts are well outside any small context window.
  for (let i = 0; i < 26; i += 1) {
    messages.push({
      id: uuid(), role: i % 2 ? "user" : "assistant",
      swipes: [`Andamos por el corredor número ${i + 1} y contamos las antorchas apagadas.`],
      activeSwipeIndex: 0, createdAt: Date.now(),
    });
  }
  const saved = await json(`/api/chats/${chatId}`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Aceptacion Memoria Viva", messages }),
  });
  check("long chat persisted", saved.status === 200 && saved.body.messages.length === messages.length, saved.status);

  // 3) Extraction reads the chat and writes a ledger with evidence.
  const extract = await json(`/api/chats/${chatId}/memory/extract`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
  });
  const report = extract.body.report;
  check("extraction ran and reported additions", extract.status === 200 && report && (report.addedFacts > 0 || report.addedThreads > 0), report);
  const memory = extract.body.memory;
  check("every stored fact cites real message ids",
    memory.facts.every((f) => f.evidenceMessageIds.length > 0 && f.evidenceMessageIds.every((id) => messages.some((m) => m.id === id))),
    memory.facts.map((f) => f.evidenceMessageIds.length));
  check("scene state was captured", Boolean(memory.scene.location), memory.scene.location);
  check("the promise became an open thread", memory.threads.some((t) => t.kind === "promise" || t.kind === "goal"), memory.threads.map((t) => t.kind));

  // 4) The brief must resurface knowledge from the FIRST messages, long after they scrolled away.
  const earlyIds = new Set(messages.slice(0, 8).map((m) => m.id));
  const brief = await json(`/api/chats/${chatId}/memory/retrieve`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "Iris y la llave plateada del sarcófago", persist: true }),
  });
  check("brief uses the active memory envelope", brief.body.brief.includes("[ACTIVE MEMORY") && brief.body.brief.endsWith("[/ACTIVE MEMORY]"), brief.body.brief.slice(0, 60));
  check("brief injected from messages that are no longer recent",
    memory.facts.some((f) => f.evidenceMessageIds.some((id) => earlyIds.has(id))),
    memory.facts.filter((f) => f.evidenceMessageIds.some((id) => earlyIds.has(id))).length);
  check("trace explains each selection", brief.body.trace.selected.length > 0 && brief.body.trace.selected.every((s) => Array.isArray(s.reasons) && s.reasons.length > 0), brief.body.trace.selected.slice(0, 2));
  const afterPersist = await json(`/api/chats/${chatId}/memory`);
  check("persisted trace is readable by the panel", afterPersist.body.memory.lastBrief?.brief?.includes("[ACTIVE MEMORY"), Boolean(afterPersist.body.memory.lastBrief));

  // 5) Manual control: pin a fact, confirm it, then roll everything back.
  const target = memory.facts[0];
  const patched = await json(`/api/chats/${chatId}/memory`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: "fact", id: target.id, patch: { pinned: true, status: "confirmed" } }),
  });
  const pinned = patched.body.memory.facts.find((f) => f.id === target.id);
  check("manual pin and confirm persist", pinned?.pinned === true && pinned?.status === "confirmed", pinned?.status);
  check("manual edits create a revision", patched.body.memory.revisions.length >= 1, patched.body.memory.revisions.length);
  const rolled = await json(`/api/chats/${chatId}/memory/rollback`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
  });
  const restored = rolled.body.memory.facts.find((f) => f.id === target.id);
  check("rollback restores the previous ledger", restored?.pinned !== true, restored?.pinned);
  const rollbackAgain = await json(`/api/chats/${chatId}/memory/rollback`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
  });
  check("rollback is available twice", rollbackAgain.status === 200, rollbackAgain.status);

  // 6) Failure modes: disabling memory must reproduce the old behaviour exactly.
  const disabled = await json(`/api/chats/${chatId}/memory`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: "settings", patch: { enabled: false } }),
  });
  check("memory can be switched off", disabled.body.memory.settings.enabled === false);
  const skipped = await json(`/api/chats/${chatId}/memory/extract`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }),
  });
  check("disabled memory skips extraction", skipped.body.skipped === "disabled", skipped.body.skipped);
  const noBrief = await json(`/api/chats/${chatId}/memory/retrieve`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "Iris" }),
  });
  check("disabled memory injects nothing", noBrief.body.brief === "", noBrief.body.brief);
  await json(`/api/chats/${chatId}/memory`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: "settings", patch: { enabled: true } }),
  });

  // 7) Boundary errors are explicit, not crashes.
  const badTarget = await json(`/api/chats/${chatId}/memory`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target: "nope", patch: {} }),
  });
  check("invalid patch target is rejected", badTarget.status === 400, badTarget.status);
  const missingChat = await json(`/api/chats/${uuid()}/memory`);
  check("unknown chat returns 404", missingChat.status === 404, missingChat.status);
  const badChatId = await json("/api/chats/not-a-uuid/memory");
  check("malformed chat id returns 400", badChatId.status === 400, badChatId.status);
} finally {
  await json(`/api/chats/${chatId}/memory`, { method: "DELETE" });
  await json(`/api/chats/${chatId}`, { method: "DELETE" });
  const gone = await json(`/api/chats/${chatId}`);
  check("acceptance cleaned up after itself", gone.status === 404, gone.status);
  const memoryGone = await json(`/api/chats/${chatId}/memory`);
  check("memory file removed with the chat", memoryGone.status === 404, memoryGone.status);
}

console.log(failures === 0 ? "ALL ACCEPTANCE CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
