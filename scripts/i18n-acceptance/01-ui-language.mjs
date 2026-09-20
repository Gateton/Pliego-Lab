/**
 * Acceptance for the interface language (i18n phase 1): choosing a language from Configuración
 * applies at once without a reload, survives a reload, keeps `<html lang>` honest, and the
 * pseudo-locale QA switch marks every translated string.
 *
 * It runs against the real app in a real browser, exactly like the memory harnesses, and restores
 * whatever language preference the browser had when it is done.
 */
import { spawn } from "node:child_process";

const BASE = process.env.I18N_BASE ?? "http://localhost:5173";
const DEVTOOLS = "http://127.0.0.1:9224";
const STORAGE_KEY = "pl.uiLanguage";
const PSEUDO_KEY = "pl.debugPseudoLocale";

let failures = 0;
function check(label, condition, detail) {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail === undefined ? "" : ` :: ${JSON.stringify(detail)}`}`);
}

/** The copy under test, from the catalogs. Native language names never translate. */
const COPY = {
  es: { title: "Idioma", group: "Idioma de la interfaz", switchTo: "English" },
  en: { title: "Language", group: "Interface language", switchTo: "Español" },
};

for (let i = 0; i < 60; i += 1) {
  if ((await fetch(`${BASE}/api/settings`).catch(() => null))?.ok) break;
  await new Promise((r) => setTimeout(r, 200));
}

// Chromium with the DevTools port open, unless one is already listening.
let chromium = null;
const targets = await fetch(`${DEVTOOLS}/json`).then((r) => r.json()).catch(() => null);
if (!targets) {
  chromium = spawn("chromium", [`--remote-debugging-port=9224`, `--user-data-dir=${process.env.JCODE_SCRATCH_DIR ?? "/tmp"}/i18n-acceptance-profile`, "--headless=new", "--no-first-run", "--no-sandbox", BASE], { stdio: "ignore" });
  for (let i = 0; i < 60; i += 1) {
    if (await fetch(`${DEVTOOLS}/json`).then((r) => r.json()).catch(() => null)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
}
const pages = await fetch(`${DEVTOOLS}/json`).then((r) => r.json()).catch(() => []);
const target = pages.find((t) => t.type === "page");
if (!target) throw new Error(`no chromium page on ${DEVTOOLS}; start Chromium with --remote-debugging-port=9224`);

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
async function reload() {
  await send("Page.navigate", { url: `${BASE}/` });
  await waitFor(`!!document.querySelector('.topbar')`, "app shell");
}

/**
 * The language group, found by the native language names it contains. Those never translate, so
 * this stays correct in both locales — and it cannot collide with the theme grid.
 */
const LANGUAGE_GROUP = `[...document.querySelectorAll('[role="radiogroup"]')].find((g) => /Español|English/.test(g.textContent))`;
const OPEN_LANGUAGE_SECTION = `(() => {
  const group = ${LANGUAGE_GROUP};
  return group ? { title: document.querySelector('h1')?.textContent ?? null, group: group.getAttribute('aria-label') } : null;
})()`;

async function openSettings() {
  await evaluate(`document.querySelector('[data-tour="menu-more"]').click()`);
  await waitFor(`!!document.querySelector('[data-tour="menu-settings"]')`, "overflow menu");
  await evaluate(`document.querySelector('[data-tour="menu-settings"]').click()`);
  await waitFor(OPEN_LANGUAGE_SECTION, "language section");
}

async function chooseLanguage(name) {
  await evaluate(`(() => {
    const group = ${LANGUAGE_GROUP};
    const card = [...group.querySelectorAll('[role="radio"]')].find((c) => c.textContent.includes(${JSON.stringify(name)}));
    if (!card) return false;
    card.click();
    return true;
  })()`);
}

const storedLocale = async () => evaluate(`window.localStorage.getItem(${JSON.stringify(STORAGE_KEY)})`);
const documentLang = async () => evaluate(`document.documentElement.lang`);

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });

  await send("Page.navigate", { url: `${BASE}/` });
  await waitFor(`!!document.querySelector('.topbar')`, "app shell");
  const previousPreference = await storedLocale();

  // 1) A browser that never chose a language follows its own.
  const browserLocale = await evaluate(`/^es/i.test(navigator.language) ? "es" : "en"`);
  await evaluate(`window.localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`);
  await reload();
  check("html lang follows the browser language", (await documentLang()) === browserLocale, { lang: await documentLang(), browserLocale });
  await openSettings();
  const initial = await evaluate(OPEN_LANGUAGE_SECTION);
  check("the language section renders in the browser language", initial.title === COPY[browserLocale].title, initial);
  check("the group carries a localized accessible name", initial.group === COPY[browserLocale].group, initial.group);

  // 2) Switching applies to every string at once, with no reload.
  const other = browserLocale === "es" ? "en" : "es";
  await chooseLanguage(COPY[browserLocale].switchTo);
  await waitFor(`${LANGUAGE_GROUP} && ${JSON.stringify(COPY[other].title)} === document.querySelector('h1').textContent`, "section in the new language");
  const switched = await evaluate(OPEN_LANGUAGE_SECTION);
  check("switching translates the section instantly", switched.title === COPY[other].title, switched);
  check("switching translates the accessible names too", switched.group === COPY[other].group, switched.group);
  check("html lang follows the choice", (await documentLang()) === other, await documentLang());
  check("the choice is persisted", (await storedLocale()) === other, await storedLocale());

  // 3) The preference outlives a reload, and the section comes back in it.
  await reload();
  check("html lang survives a reload", (await documentLang()) === other, await documentLang());
  await openSettings();
  const reloaded = await evaluate(OPEN_LANGUAGE_SECTION);
  check("the section comes back in the saved language", reloaded.title === COPY[other].title, reloaded);

  // 4) The pseudo-locale marks translated copy and leaves untranslatable names alone.
  await evaluate(`window.localStorage.setItem(${JSON.stringify(PSEUDO_KEY)}, "1")`);
  await reload();
  await openSettings();
  const pseudo = await evaluate(OPEN_LANGUAGE_SECTION);
  check("the pseudo-locale marks translated strings", pseudo.title === `⟦${COPY[other].title}⟧`, pseudo.title);
  const nativeNames = await evaluate(`(() => {
    const group = ${LANGUAGE_GROUP};
    return [...group.querySelectorAll('[role="radio"]')].map((c) => c.textContent.includes('Español') || c.textContent.includes('English'));
  })()`);
  check("language names stay out of the pseudo-locale", nativeNames.every(Boolean), nativeNames);
  await evaluate(`window.localStorage.removeItem(${JSON.stringify(PSEUDO_KEY)})`);

  // 5) Back to where we started, so the harness does not leave a preference behind.
  await chooseLanguage(COPY[other].switchTo);
  await waitFor(`document.documentElement.lang === ${JSON.stringify(browserLocale)}`, "back to the starting language");
  check("switching back works as well", (await evaluate(OPEN_LANGUAGE_SECTION)).title === COPY[browserLocale].title);
  if (previousPreference === null) await evaluate(`window.localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`);
  else await evaluate(`window.localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, ${JSON.stringify(previousPreference)})`);
  check("the harness restored the previous preference", (await storedLocale()) === previousPreference, await storedLocale());
} finally {
  ws.close();
  chromium?.kill();
}
console.log(failures === 0 ? "ALL I18N ACCEPTANCE CHECKS PASSED" : `${failures} I18N CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
