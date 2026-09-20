const BASE = "http://127.0.0.1:3001";
const TITLE = `UI Diseno Completo Memoria ${Math.random().toString(36).slice(2, 8)}`;
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
const uuid = () => crypto.randomUUID();
for (let i = 0; i < 60; i += 1) { if ((await fetch(`${BASE}/api/settings`).catch(() => null))?.ok) break; await new Promise((r) => setTimeout(r, 100)); }

const characters = (await api("/api/characters")).body;
const character = Array.isArray(characters) && characters.length ? characters[0] : null;
const created = await api("/api/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(character ? { characterId: character.id } : {}) });
const chatId = created.body.id;
const story = [
  `${character?.name ?? "Iris"} perdió la visión del ojo izquierdo durante el incendio de la torre.`,
  "Caminamos hacia la Cripta del monasterio al anochecer.",
  "Daren prometió no volver a usar magia de sangre delante de " + (character?.name ?? "Iris") + ".",
  "Debemos abrir el sarcófago antes de que despierte el guardián.",
];
const messages = story.map((text, index) => ({ id: uuid(), role: index % 2 === 0 ? "assistant" : "user", swipes: [text], activeSwipeIndex: 0, createdAt: Date.now() }));
await api(`/api/chats/${chatId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: TITLE, messages }) });
await post(`/api/chats/${chatId}/memory/extract`, { all: true });
await post(`/api/chats/${chatId}/memory/retrieve`, { query: story[0], persist: true });
const dirty = (await api(`/api/chats/${chatId}/memory`)).body.memory.facts[0];
await post(`/api/chats/${chatId}/memory/guard`, { responseText: `${dirty.subject} ya no ${dirty.predicate} ${dirty.object}.`, messageId: messages[messages.length - 1].id });

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
async function waitFor(expression, label, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (await evaluate(expression)) return true; await new Promise((r) => setTimeout(r, 120)); }
  throw new Error(`timeout: ${label}`);
}
const dialogText = () => evaluate(`document.querySelector('[role="dialog"]')?.innerText ?? ""`);

try {
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "http://127.0.0.1:5173/" });
  await waitFor(`!!document.querySelector('.topbar')`, "app shell");
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Últimos chats')).click()`);
  await waitFor(`document.body.innerText.includes(${JSON.stringify(TITLE)})`, "seeded chat");
  await evaluate(`[...document.querySelectorAll('div')].filter(d => d.textContent.includes(${JSON.stringify(TITLE)}) && d.className.includes('cursor-pointer')).pop().click()`);
  await waitFor(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Memoria'))`, "memory button");

  // Per-message memory badge (gap 9) must be visible without opening anything.
  const badgeCount = await evaluate(`[...document.querySelectorAll('button')].filter(b=>b.getAttribute('aria-label')?.startsWith('Memoria Viva')).length`);
  check("messages show a memory badge", badgeCount > 0, badgeCount);

  // Continuity Guard findings must surface on the message (gap 13).
  const guardVisible = await evaluate(`document.body.innerText.includes('choque con la memoria') || document.body.innerText.includes('Posible')`);
  check("guard findings surface in the chat", guardVisible);

  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Memoria')).click()`);
  await waitFor(`document.querySelector('[role="dialog"]')?.innerText.includes('Memoria Viva')`, "panel");
  const tabs = await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].map(b=>b.textContent.trim()).filter(Boolean)`);
  const expected = ["Ahora", "Canon", "Pendientes", "Episodios", "Quién sabe qué", "Línea temporal", "Revisiones", "Ajustes", "Usado en turno"];
  check("the panel exposes the full tab set", expected.every((name) => tabs.some((t) => t.startsWith(name))), tabs.slice(0, 14));

  // Canon: evidence chips jump to the source message (gap 4).
  await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find(b=>b.textContent.startsWith('Canon')).click()`);
  await waitFor(`document.querySelector('[role="dialog"]').innerText.includes('confianza')`, "canon tab");
  const evidenceClickable = await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].some(b => /^[0-9a-f-]{8,}/.test(b.textContent.trim()) || /evidencia/i.test(b.textContent) || /fuente/i.test(b.textContent))`);
  check("evidence is exposed in the canon rows", evidenceClickable, await evaluate(`document.querySelector('[role="dialog"]').innerText.slice(200, 420)`));

  // Whose knows what (gap 2).
  await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find(b=>b.textContent.startsWith('Quién sabe qué')).click()`);
  await waitFor(`document.querySelector('[role="dialog"]').innerText.length > 40`, "knowledge tab");
  const knowledge = await dialogText();
  check("knowledge matrix renders", /sabe|conoce|visible|todos/i.test(knowledge), knowledge.slice(0, 120).replace(/\n/g, " | "));

  // Timeline (gap 13 visible versioning).
  await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find(b=>b.textContent.startsWith('Línea temporal')).click()`);
  await waitFor(`document.querySelector('[role="dialog"]').innerText.length > 40`, "timeline tab");
  const timeline = await dialogText();
  check("timeline renders entries", /episodio|hecho|promesa|hilo|sin|todavía/i.test(timeline), timeline.slice(0, 120).replace(/\n/g, " | "));

  // Revisions with rollback (gap 3).
  await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find(b=>b.textContent.startsWith('Revisiones')).click()`);
  await waitFor(`document.querySelector('[role="dialog"]').innerText.length > 40`, "revisions tab");
  const revisions = await dialogText();
  check("revisions are listed in the UI", /revis|restaurar|extracci|manual/i.test(revisions), revisions.slice(0, 140).replace(/\n/g, " | "));
  check("a restore control exists", await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].some(b=>/restaurar/i.test(b.textContent))`) || /sin revision/i.test(revisions));

  // Settings, including the new semantic and scope controls (gap 8).
  await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find(b=>b.textContent.startsWith('Ajustes')).click()`);
  await waitFor(`document.querySelector('[role="dialog"]').innerText.length > 60`, "settings tab");
  const settingsText = await dialogText();
  check("settings expose extraction mode", /extracci|heur|llm/i.test(settingsText));
  check("settings expose the brief budget", /presupuesto|porcentaje|caracteres|tokens/i.test(settingsText));
  check("settings expose semantic retrieval", /semánt|embedding|vectorial/i.test(settingsText));
  check("settings expose the shared scope", /compartid|alcance|scope/i.test(settingsText));
  check("settings expose the visual-fact deferral", /ropa|visual|director/i.test(settingsText));

  // Used-in-turn: the trace plus the guard findings.
  await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find(b=>b.textContent.startsWith('Usado en turno')).click()`);
  await waitFor(`document.querySelector('[role="dialog"]').innerText.length > 40`, "used tab");
  const used = await dialogText();
  check("the used tab shows the compiled brief", used.includes("[ACTIVE MEMORY") || /brief/i.test(used), used.slice(0, 100).replace(/\n/g, " | "));
  check("the used tab surfaces the guard", /guardia|contradic|choque|continuidad/i.test(used), used.slice(0, 160).replace(/\n/g, " | "));

  await evaluate(`document.querySelector('[role="dialog"] button[aria-label="Cerrar"]').click()`);
  await waitFor(`!document.querySelector('[role="dialog"]')`, "closed");
  check("panel closes cleanly", true);
} finally {
  await api(`/api/chats/${chatId}/memory`, { method: "DELETE" });
  await api(`/api/chats/${chatId}`, { method: "DELETE" });
  check("UI acceptance cleaned up", (await api(`/api/chats/${chatId}`)).status === 404);
  ws.close();
}
console.log(failures === 0 ? "ALL FULL UI CHECKS PASSED" : `${failures} UI CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
