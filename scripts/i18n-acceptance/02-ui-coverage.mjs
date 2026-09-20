/**
 * Coverage audit for the interface translation.
 *
 * It walks the real app in English with the QA pseudo-locale on, where every string that comes from
 * the catalog is wrapped in ⟦…⟧. Anything visible without markers is copy that was never migrated,
 * which is the only way to catch the single-word labels the static guard cannot see.
 *
 * The chat thread is excluded on purpose: it holds the user's own messages and the model's output,
 * which are never translated and would drown the report.
 *
 * It exits non-zero when it finds untranslated text that looks Spanish, so it can be used as the
 * closing gate of the migration. Screens that list the user's own content (lorebooks, presets,
 * personas, rules, recast presets) are reviewed but never fail the run: a book entry written in
 * Spanish and an untranslated label look exactly the same from the DOM, so those screens are
 * reported for a human to read. Everything else it prints is informational.
 */
import { spawn } from "node:child_process";

const BASE = process.env.I18N_BASE ?? "http://localhost:5173";
const DEVTOOLS = "http://127.0.0.1:9224";

const BASE_API = BASE;
const SEED_TITLE = `i18n coverage ${Math.random().toString(36).slice(2, 8)}`;
let seededChatId = null;

async function api(path, options) {
  const response = await fetch(`${BASE_API}${path}`, options);
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  return { status: response.status, body };
}

let failures = 0;
function check(label, condition, detail) {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail === undefined ? "" : ` :: ${JSON.stringify(detail)}`}`);
}

for (let i = 0; i < 60; i += 1) {
  if ((await fetch(`${BASE}/api/settings`).catch(() => null))?.ok) break;
  await new Promise((r) => setTimeout(r, 200));
}

let chromium = null;
if (!(await fetch(`${DEVTOOLS}/json`).then((r) => r.json()).catch(() => null))) {
  chromium = spawn("chromium", ["--remote-debugging-port=9224", `--user-data-dir=${process.env.JCODE_SCRATCH_DIR ?? "/tmp"}/i18n-coverage-profile`, "--headless=new", "--no-first-run", "--no-sandbox", BASE], { stdio: "ignore" });
  for (let i = 0; i < 60; i += 1) {
    if (await fetch(`${DEVTOOLS}/json`).then((r) => r.json()).catch(() => null)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
}
const pages = await fetch(`${DEVTOOLS}/json`).then((r) => r.json()).catch(() => []);
const target = pages.find((t) => t.type === "page");
if (!target) throw new Error(`no chromium page on ${DEVTOOLS}`);

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

/**
 * Visible strings that are not marked as translated. Text nodes only, plus the attributes a person
 * can actually read; `alt` is left out because it usually carries the character's name.
 */
const HARVEST = `(() => {
  // Three things are not interface copy: the chat thread (the model's output), anything the person
  // brought themselves, and the text that travels to the model.
  const SKIP = '[data-tour="chat-thread"], [data-user-data], [data-prompt-content]';
  const TRANSLATED = /⟦/;
  const out = [];
  const visible = (el) => {
    if (!el || !el.getBoundingClientRect) return false;
    if (el.closest(SKIP)) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.textContent.trim();
    if (text.length < 2 || TRANSLATED.test(text)) continue;
    if (!/\\p{L}{2}/u.test(text)) continue;
    if (!visible(node.parentElement)) continue;
    out.push({ kind: "text", text });
  }
  for (const el of document.querySelectorAll('[aria-label], [title], [placeholder]')) {
    if (!visible(el)) continue;
    for (const attribute of ["aria-label", "title", "placeholder"]) {
      const value = el.getAttribute(attribute);
      if (!value || value.length < 2 || TRANSLATED.test(value)) continue;
      if (!/\\p{L}{2}/u.test(value)) continue;
      out.push({ kind: attribute, text: value });
    }
  }
  const seen = new Set();
  return out.filter((entry) => {
    const key = entry.kind + ":" + entry.text;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
})()`;

const SPANISH = /[¿¡ñ]|\b(el|la|los|las|un|una|unos|de|del|que|con|para|por|sin|más|tu|tus|vos|es|son|está|están|no|se|al|lo|le|si|ya|hay|como|pero|muy|todo|toda|este|esta|esto|cada|desde|entre|cómo|qué|dónde|cuándo)\b/i;

/**
 * Text that is deliberately not translated, so it is not a coverage gap: each language is named in
 * its own language, the product keeps its name, and slash commands are what you type.
 */
const EXPECTED = new Set(["Pliego Lab", "Español", "English", "Français", "Português", "Deutsch", "Italiano", "日本語"]);
const UNITS = /^(?:px|ms|rem|em|k|s|tokens|%|\d+(?:[.,]\d+)?\s?(?:px|ms|%|rem|em|k|tokens))$/i;
// A provider model id is configuration, not copy: `vendor/model-name`.
const MODEL_ID = /^[\w.-]+\/[\w.:-]+$/;
const isExpected = (text) => EXPECTED.has(text) || /^\/\S+$/.test(text) || UNITS.test(text) || MODEL_ID.test(text);

const isMissing = (entry) => !isExpected(entry.text);

const OPEN_RECENT = `[...document.querySelectorAll('button')].find((b) => /Últimos chats|Recent chats/.test(b.textContent))?.click()`;
const OPEN_SEEDED_CHAT = `(() => {
  const title = [...document.querySelectorAll('[data-user-data]')].find((el) => el.textContent.includes(${JSON.stringify(SEED_TITLE)}));
  const row = title && (title.closest('div[class*="cursor-pointer"]') || title.parentElement?.closest('div[class*="cursor-pointer"]'));
  if (!row) return false;
  row.click();
  return true;
})()`;

const SCREENS = [
  { label: "shell", open: [] },
  { label: "menu ⋮", open: ['document.querySelector(\'[data-tour="menu-more"]\').click()'] },
  { label: "menú de ayuda", open: ['document.querySelector(\'[data-tour="btn-help"]\').click()'] },
  { label: "Configuración", open: ['document.querySelector(\'[data-tour="menu-more"]\').click()', 'document.querySelector(\'[data-tour="menu-settings"]\').click()'] },
  { label: "Presets", data: true, open: ['document.querySelector(\'[data-tour="btn-presets"]\').click()'] },
  { label: "Personas", data: true, open: ['document.querySelector(\'[data-tour="btn-personas"]\').click()'] },
  { label: "Lorebooks", data: true, open: ['document.querySelector(\'[data-tour="btn-lorebooks"]\').click()'] },
  { label: "Crear personaje", open: ['document.querySelector(\'[data-tour="btn-character-creator"]\').click()'] },
  { label: "Director", open: ['document.querySelector(\'[data-tour="btn-director"]\').click()'] },
  { label: "Estudio", data: true, open: ['document.querySelector(\'[data-tour="btn-estudio"]\').click()'] },
  { label: "Gateton RP", open: ['document.querySelector(\'[data-tour="btn-gateton-rp"]\').click()'] },
  { label: "ComfyInject", open: ['document.querySelector(\'[data-tour="btn-comfyinject"]\').click()'] },
  { label: "Recast", data: true, open: ['document.querySelector(\'[data-tour="btn-recast"]\').click()'] },
  { label: "NPCs", open: ['document.querySelector(\'[data-tour="btn-npc"]\').click()'] },
  {
    label: "asistente de primera vez",
    path: "?wizard=1",
    steps: [{ do: "null", wait: `!!document.querySelector('[role="dialog"]')` }],
  },
  {
    label: "guía de la interfaz",
    path: "?tour=1",
    steps: [{ do: "null", wait: `!!document.querySelector('[class*="sg-tour"], [class*="tour"]')` }],
  },
  { label: "Importar ST", open: ['document.querySelector(\'[data-tour="menu-more"]\').click()', 'document.querySelector(\'[data-tour="menu-importst"]\').click()'] },
  {
    label: "chat abierto",
    steps: [
      { do: OPEN_RECENT, wait: `document.body.textContent.includes(${JSON.stringify(SEED_TITLE)})` },
      { do: OPEN_SEEDED_CHAT, wait: `!!document.querySelector('[data-tour="chat-tools"]')` },
    ],
  },
  {
    label: "menú Vista",
    steps: [
      { do: OPEN_RECENT, wait: `document.body.textContent.includes(${JSON.stringify(SEED_TITLE)})` },
      { do: OPEN_SEEDED_CHAT, wait: `!!document.querySelector('[data-tour="chat-tools"]')` },
      { do: `document.querySelector('[data-tour="view-menu"]').click()`, wait: `!!document.querySelector('[data-tour="view-menu-panel"]')` },
    ],
  },
  {
    label: "panel Memoria Viva",
    steps: [
      { do: OPEN_RECENT, wait: `document.body.textContent.includes(${JSON.stringify(SEED_TITLE)})` },
      { do: OPEN_SEEDED_CHAT, wait: `!!document.querySelector('[data-tour="chat-tools"]')` },
      {
        do: `document.querySelector('[data-tour="chat-memory"]').click()`,
        wait: `!!document.querySelector('[role="dialog"]')`,
      },
    ],
  },
];

const report = [];
let previousState = null;

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });

  // A real chat, created and deleted by the harness, so the chat surfaces are covered without
  // touching whatever the user already has open.
  const characterList = (await api("/api/characters")).body;
  const characterId = Array.isArray(characterList) && characterList.length ? characterList[0].id : undefined;
  const created = await api("/api/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(characterId ? { characterId } : {}),
  });
  seededChatId = created.body?.id ?? null;
  if (seededChatId) {
    await api(`/api/chats/${seededChatId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: SEED_TITLE, messages: [{ id: crypto.randomUUID(), role: "assistant", swipes: ["Contenido de prueba."], activeSwipeIndex: 0, createdAt: Date.now() }] }),
    });
  }

  await send("Page.navigate", { url: `${BASE}/` });
  await waitFor(`!!document.querySelector('.topbar')`, "app shell");
  previousState = await evaluate(`JSON.stringify({ locale: window.localStorage.getItem('pl.uiLanguage'), pseudo: window.localStorage.getItem('pl.debugPseudoLocale') })`);
  // English plus the pseudo-locale, set once; the reloads below keep both.
  await evaluate(`window.localStorage.setItem('pl.uiLanguage', 'en'); window.localStorage.setItem('pl.debugPseudoLocale', '1')`);

  for (const screen of SCREENS) {
    await send("Page.navigate", { url: `${BASE}/${screen.path ?? ""}` });
    await waitFor(`!!document.querySelector('.topbar')`, `app shell: ${screen.label}`);
    for (const step of screen.steps ?? screen.open ?? []) {
      const expression = typeof step === "string" ? step : step.do;
      const expectation = typeof step === "string" ? null : step.wait;
      let ready = false;
      for (let attempt = 0; attempt < 20 && !ready; attempt += 1) {
        // A step can legitimately fail its first time (the element is not on screen yet), and a
        // missing element throws: neither should abort the whole walk.
        await evaluate(expression).catch(() => {});
        if (expectation === null) { ready = true; break; }
        ready = await evaluate(`!!(${expectation})`).catch(() => false);
        if (!ready) await new Promise((r) => setTimeout(r, 250));
      }
      if (expectation !== null) check(`${screen.label}: reached the screen`, ready, expression.slice(0, 60));
    }
    await new Promise((r) => setTimeout(r, 700));
    const entries = await evaluate(HARVEST);
    report.push({ screen: screen.label, entries, data: screen.data === true });
    const missing = entries.filter(isMissing);
    const spanish = missing.filter((entry) => SPANISH.test(entry.text));
    const note = screen.data ? " (lista con datos del usuario: informativo)" : "";
    console.log(`\n${screen.label}: ${missing.length} sin marcar${spanish.length ? `, ${spanish.length} en español` : ""}${note}`);
    // Data-bearing screens are listed so a human can skim them, but their findings never fail the run.
    for (const entry of missing.slice(0, 20)) console.log(`   ${SPANISH.test(entry.text) ? "ES" : "  "} [${entry.kind}] ${entry.text}`);
    if (missing.length > 20) console.log(`   … y ${missing.length - 20} más`);
  }
} finally {
  // Leave the browser's own preference the way it was found.
  if (typeof previousState === "string") {
    const { locale, pseudo } = JSON.parse(previousState);
    await evaluate(`(() => {
      const restore = (key, value) => value === null ? window.localStorage.removeItem(key) : window.localStorage.setItem(key, value);
      restore('pl.uiLanguage', ${JSON.stringify(locale)});
      restore('pl.debugPseudoLocale', ${JSON.stringify(pseudo)});
    })()`).catch(() => {});
  }
  // Leave the app before deleting the chat: the UI has it selected and would keep reading it.
  await send("Page.navigate", { url: "about:blank" }).catch(() => {});
  if (seededChatId) await api(`/api/chats/${seededChatId}`, { method: "DELETE" });
  ws.close();
  chromium?.kill();
}

const gated = report.filter((entry) => !entry.data);
const total = gated.reduce((sum, entry) => sum + entry.entries.filter(isMissing).length, 0);
const spanish = gated.flatMap((entry) => entry.entries.filter((item) => isMissing(item) && SPANISH.test(item.text)));
console.log(`\n${total} string(s) without translation markers (excluding the deliberate ones); ${spanish.length} look Spanish.`);
check("no untranslated Spanish text is still visible", spanish.length === 0, spanish.slice(0, 12).map((item) => item.text));
console.log(failures === 0 ? "I18N COVERAGE LOOKS COMPLETE" : `${failures} COVERAGE CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
