/**
 * Proves the most important gap is really closed: editing a message in the UI invalidates the
 * memory that cited it, through the real frontend -> API path.
 */
const BASE = "http://127.0.0.1:3001";
const TITLE = `UI Invalidacion Memoria ${Math.random().toString(36).slice(2, 8)}`;
let failures = 0;
function check(label, condition, detail) {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail === undefined ? "" : ` :: ${JSON.stringify(detail)}`}`);
}
async function api(path, options) {
  const r = await fetch(`${BASE}${path}`, options);
  return { status: r.status, body: r.status === 204 ? null : await r.json().catch(() => null) };
}
const post = (p, b) => api(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b ?? {}) });
const uuid = () => crypto.randomUUID();
for (let i = 0; i < 60; i += 1) { if ((await fetch(`${BASE}/api/settings`).catch(() => null))?.ok) break; await new Promise((r) => setTimeout(r, 100)); }

const characters = (await api("/api/characters")).body;
const character = Array.isArray(characters) && characters.length ? characters[0] : null;
const created = await api("/api/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(character ? { characterId: character.id } : {}) });
const chatId = created.body.id;
const messages = [
  { id: uuid(), role: "assistant", swipes: ["Daren prometió no volver a usar magia de sangre delante de Iris."], activeSwipeIndex: 0, createdAt: Date.now() },
  { id: uuid(), role: "user", swipes: ["Caminamos hacia la Cripta del monasterio al anochecer."], activeSwipeIndex: 0, createdAt: Date.now() },
  { id: uuid(), role: "assistant", swipes: ["Iris guarda silencio junto al sarcófago."], activeSwipeIndex: 0, createdAt: Date.now() },
];
await api(`/api/chats/${chatId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: TITLE, messages }) });
await post(`/api/chats/${chatId}/memory/extract`, { all: true });
const before = (await api(`/api/chats/${chatId}/memory`)).body.memory;
const dependent = before.facts.find((f) => f.evidenceMessageIds.includes(messages[0].id));
check("a fact cites the first message", Boolean(dependent), before.facts.map((f) => f.evidenceMessageIds));
check("nothing needs review before the edit", before.facts.every((f) => !f.needsReview), before.facts.filter((f) => f.needsReview).length);

const targets = await fetch("http://127.0.0.1:9224/json").then((r) => r.json());
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } };
const send = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); });
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}
async function waitFor(expression, label, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (await evaluate(expression)) return true; await new Promise((r) => setTimeout(r, 150)); }
  throw new Error(`timeout: ${label}`);
}

try {
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "http://127.0.0.1:5173/" });
  await waitFor(`!!document.querySelector('.topbar')`, "app shell");
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Últimos chats')).click()`);
  await waitFor(`document.body.innerText.includes(${JSON.stringify(TITLE)})`, "seeded chat listed");
  await evaluate(`[...document.querySelectorAll('div')].filter(d => d.textContent.includes(${JSON.stringify(TITLE)}) && d.className.includes('cursor-pointer')).pop().click()`);
  await waitFor(`!!document.querySelector('[data-message-id="${messages[0].id}"]')`, "first message rendered");

  // Edit the message the fact depends on, exactly as a user would.
  await evaluate(`(() => {
    const row = document.querySelector('[data-message-id="${messages[0].id}"]');
    const button = [...row.querySelectorAll('button')].find(b => b.textContent.trim() === 'Editar');
    if (!button) throw new Error('edit button not found');
    button.click();
    return true;
  })()`);
  await waitFor(`!!document.querySelector('[data-message-id="${messages[0].id}"] textarea')`, "editor open");
  await evaluate(`(() => {
    const row = document.querySelector('[data-message-id="${messages[0].id}"]');
    const textarea = row.querySelector('textarea');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(textarea, 'Daren nunca prometió nada: siempre usó magia de sangre a escondidas.');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    return textarea.value;
  })()`);
  await evaluate(`(() => {
    const row = document.querySelector('[data-message-id="${messages[0].id}"]');
    [...row.querySelectorAll('button')].find(b => b.textContent.trim() === 'Guardar').click();
    return true;
  })()`);
  await waitFor(`!document.querySelector('[data-message-id="${messages[0].id}"] textarea')`, "edit saved");

  // The invalidation happens in the background, so poll the API for the result.
  let after = null;
  for (let i = 0; i < 40; i += 1) {
    after = (await api(`/api/chats/${chatId}/memory`)).body.memory;
    if (after.facts.some((f) => f.needsReview)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  check("editing a message flags the memory that cited it", after.facts.some((f) => f.needsReview), after.facts.map((f) => ({ id: f.id.slice(0, 8), needsReview: f.needsReview })));
  check("the flagged fact is the dependent one", after.facts.find((f) => f.needsReview)?.id === dependent.id, { expected: dependent.id.slice(0, 8), flagged: after.facts.filter((f) => f.needsReview).map((f) => f.id.slice(0, 8)) });
  check("an invalidation revision was recorded", after.revisions.length > before.revisions.length, { before: before.revisions.length, after: after.revisions.length });
  const lastRevision = after.revisions.at(-1);
  check("the revision explains why", /edit|elimin|swipe|invalid/i.test(lastRevision.summary), lastRevision.summary);

  // The panel must show the pending review, which is the user-visible half of the same fix.
  const badge = await evaluate(`[...document.querySelectorAll('button')].filter(b=>/a revisar/.test(b.getAttribute('aria-label') ?? '')).length`);
  check("the message badge announces the pending review", badge > 0, badge);
} finally {
  await api(`/api/chats/${chatId}/memory`, { method: "DELETE" });
  await api(`/api/chats/${chatId}`, { method: "DELETE" });
  check("invalidation acceptance cleaned up", (await api(`/api/chats/${chatId}`)).status === 404);
  ws.close();
}
console.log(failures === 0 ? "ALL INVALIDATION UI CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
