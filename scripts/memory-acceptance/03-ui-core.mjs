const BASE = "http://127.0.0.1:3001";
const TITLE = `UI Memoria Aceptacion ${Math.random().toString(36).slice(2, 8)}`;
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
const uuid = () => crypto.randomUUID();

for (let i = 0; i < 60; i += 1) {
  if ((await fetch(`${BASE}/api/settings`).catch(() => null))?.ok) break;
  await new Promise((r) => setTimeout(r, 100));
}

// Seed a real chat through the public API so the UI has something to open.
const characters = (await api("/api/characters")).body;
const characterId = Array.isArray(characters) && characters.length ? characters[0].id : undefined;
const created = await api("/api/chats", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify(characterId ? { characterId } : {}),
});
const chatId = created.body.id;
const messages = [
  { id: uuid(), role: "assistant", swipes: ["Iris perdió la visión del ojo izquierdo durante el incendio."], activeSwipeIndex: 0, createdAt: Date.now() },
  { id: uuid(), role: "assistant", swipes: ["Daren prometió no volver a usar magia de sangre delante de Iris."], activeSwipeIndex: 0, createdAt: Date.now() },
  { id: uuid(), role: "user", swipes: ["Caminamos hacia la Cripta del monasterio al anochecer."], activeSwipeIndex: 0, createdAt: Date.now() },
  { id: uuid(), role: "user", swipes: ["Debemos abrir el sarcófago antes del amanecer."], activeSwipeIndex: 0, createdAt: Date.now() },
];
await api(`/api/chats/${chatId}`, {
  method: "PUT", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: TITLE, messages }),
});

const targets = await fetch("http://127.0.0.1:9224/json").then((r) => r.json());
const target = targets.find((t) => t.type === "page");
if (!target) throw new Error("no chromium page");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const next = ++id;
  pending.set(next, { resolve, reject });
  ws.send(JSON.stringify({ id: next, method, params }));
});
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression, label, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(expression)) return true;
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error(`timeout: ${label}`);
}

try {
  /**
   * The panel re-reads memory in the background, so a tab click can land while React is swapping
   * rows. Retry until the expected content is actually on screen instead of assuming one click wins.
   */
  async function openTab(label, expected) {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      await evaluate(`(() => { const b=[...document.querySelectorAll('[role="dialog"] button')].find(x=>x.textContent.trim().startsWith(${JSON.stringify(label)})); if (b) b.click(); return !!b; })()`);
      for (let wait = 0; wait < 8; wait += 1) {
        if (await evaluate(`document.querySelector('[role="dialog"]')?.innerText.includes(${JSON.stringify(expected)})`)) return true;
        await new Promise((r) => setTimeout(r, 120));
      }
    }
    return false;
  }

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "http://127.0.0.1:5173/" });
  await waitFor(`!!document.querySelector('.topbar')`, "app shell");

  // The 6 themes feature from the previous task must still be intact after this change.
  await evaluate(`document.querySelector('button[aria-label="Más herramientas"]').click()`);
  await waitFor(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Configuración')`, "menu");
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Configuración').click()`);
  await waitFor(`document.querySelectorAll('[role="radio"]').length === 6`, "themes still present");
  check("themes feature still works after the memory change", await evaluate(`document.querySelectorAll('[role="radio"]').length`) === 6);
  await evaluate(`document.querySelector('[role="dialog"] button[aria-label="Cerrar"]').click()`);
  await waitFor(`!document.querySelector('[role="dialog"]')`, "overlay closed");

  // Open the seeded chat from the real "Últimos chats" list in the library panel.
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Últimos chats')).click()`);
  await waitFor(`document.body.innerText.includes(${JSON.stringify(TITLE)})`, "seeded chat listed");
  check("seeded chat appears in the library", true);
  await evaluate(`[...document.querySelectorAll('div')].filter(d => d.textContent.includes(${JSON.stringify(TITLE)}) && d.className.includes('cursor-pointer')).pop().click()`);
  await waitFor(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Memoria'))`, "memory button in chat header");
  check("memory button is reachable from the chat header", true);

  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Memoria')).click()`);
  await waitFor(`document.querySelector('[role="dialog"]')?.innerText.includes('Memoria Viva')`, "memory modal");
  const opened = await evaluate(`document.querySelector('[role="dialog"]').innerText`);
  check("panel reports memory as active", opened.includes("Memoria Viva activa"), opened.slice(0, 80));
  check("panel shows an empty state before extraction", opened.includes("todavía está vacía") || opened.includes("Versión 1"), opened.slice(0, 160));

  // Real toggle round-trip through the UI. The panel refreshes in the background, so each step
  // waits for the click to be applied instead of assuming a single render.
  async function clickToggle(label) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const clicked = await evaluate(`(() => { const b=[...document.querySelectorAll('[role="dialog"] button')].find(x=>x.textContent.trim()===${JSON.stringify(label)}); if (b) { b.click(); return true; } return false; })()`);
      if (clicked) return true;
      await new Promise((r) => setTimeout(r, 150));
    }
    return false;
  }
  async function waitForEnabled(expected) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if ((await api(`/api/chats/${chatId}/memory`)).body.memory.settings.enabled === expected) return true;
      await new Promise((r) => setTimeout(r, 200));
    }
    return false;
  }
  check("the disable control is reachable", await clickToggle("Desactivar"));
  check("UI toggle persisted to the backend", await waitForEnabled(false));
  check("the enable control is reachable", await clickToggle("Activar"));
  check("UI re-enable persisted", await waitForEnabled(true));

  // Extraction happens outside the UI (no provider configured here); the panel must show it after a refresh.
  await api(`/api/chats/${chatId}/memory/extract`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find(b=>b.textContent.includes('Actualizar')).click()`);
  await new Promise((r) => setTimeout(r, 600));
  await waitFor(`document.querySelector('[role="dialog"]').innerText.includes('Canon')`, "memory refreshed");
  const loaded = await evaluate(`document.querySelector('[role="dialog"]').innerText`);
  check("canon tab reports extracted facts", /Canon \(\d+\)/.test(loaded), loaded.match(/Canon[^\\n]*/)?.[0]);
  check("pending tab reports open threads", /Pendientes \(\d+\)/.test(loaded), loaded.match(/Pendientes[^\\n]*/)?.[0]);

  // Canon tab renders the facts and their evidence.
  check("the canon tab opens with fact rows", await openTab("Canon", "confianza"));
  const canon = await evaluate(`document.querySelector('[role="dialog"]').innerText`);
  const evidenceChip = await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].some(b => /^[0-9a-f]{8}/.test(b.textContent.trim()) || /[0-9a-f]{8}…/.test(b.textContent))`);
  check("facts render with confidence", canon.includes("confianza"), canon.slice(0, 120));
  check("facts expose their evidence", evidenceChip, canon.slice(0, 120));
  check("pin control is available", await evaluate(`!!document.querySelector('[role="dialog"] button[title*="Fijar"], [role="dialog"] button[title*="fijar"]')`));

  // The scene tab shows the extracted scene.
  check("the scene tab opens", await openTab("Ahora", "Ubicación"));
  const scene = await evaluate(`document.querySelector('[role="dialog"]').innerText`);
  check("scene tab shows the extracted location", scene.includes("monasterio"), scene.slice(0, 200));

  await evaluate(`document.querySelector('[role="dialog"] button[aria-label="Cerrar"]').click()`);
  await waitFor(`!document.querySelector('[role="dialog"]')`, "modal closed");
  check("panel closes cleanly", true);
} finally {
  await api(`/api/chats/${chatId}/memory`, { method: "DELETE" });
  await api(`/api/chats/${chatId}`, { method: "DELETE" });
  check("UI acceptance cleaned up after itself", (await api(`/api/chats/${chatId}`)).status === 404);
  ws.close();
}
console.log(failures === 0 ? "ALL UI ACCEPTANCE CHECKS PASSED" : `${failures} UI CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
