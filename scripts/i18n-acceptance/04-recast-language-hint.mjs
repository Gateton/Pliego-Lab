import { spawn } from "node:child_process";/**
 * Acceptance for the note on a Recast pass prompt.
 *
 * A pass is sent to the model exactly as written, so a pass whose text pins a language beats the
 * configured output language. That is the user's call, but it has to be visible where the prompt is
 * written, in the language the interface is in.
 *
 * Opens the Recast panel, opens a preset, and reads the hint in both locales.
 */

const DEVTOOLS = "http://127.0.0.1:9224";
if (!(await fetch(`${DEVTOOLS}/json`).then((r) => r.json()).catch(() => null))) {
  spawn("chromium", ["--remote-debugging-port=9224", `--user-data-dir=${process.env.JCODE_SCRATCH_DIR}/hint-profile`, "--headless=new", "--no-first-run", "--no-sandbox", "about:blank"], { stdio: "ignore", detached: true }).unref();
  for (let i = 0; i < 60; i += 1) { if (await fetch(`${DEVTOOLS}/json`).then((r) => r.json()).catch(() => null)) break; await new Promise((r) => setTimeout(r, 250)); }
}
const target = (await fetch(`${DEVTOOLS}/json`).then((r) => r.json())).find((t) => t.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result.value;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");

let failures = 0;
const check = (label, ok, detail) => { if (!ok) failures += 1; console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail === undefined ? "" : ` :: ${JSON.stringify(detail)}`}`); };

for (const locale of ["en", "es"]) {
  await send("Page.navigate", { url: "http://localhost:3001/" });
  await pause(2500);
  await evaluate(`window.localStorage.setItem('pl.uiLanguage','${locale}'); window.localStorage.setItem('pl.debugPseudoLocale','1')`);
  await send("Page.navigate", { url: "http://localhost:3001/" });
  await pause(2500);
  await evaluate(`document.querySelector('[data-tour="btn-recast"]').click()`);
  await pause(1500);
  // The preset's pencil icon opens the passes editor.
  await evaluate(`(() => { const b = document.querySelector('[role="dialog"] button[aria-label]'); const pencil = [...document.querySelectorAll('[role="dialog"] button')].find((x) => x.querySelector('svg.lucide-pencil')); if (pencil) pencil.click(); return !!pencil; })()`);
  await pause(1500);
  const hint = await evaluate(`(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) { const text = walker.currentNode.textContent; if (/Se manda tal cual|It is sent exactly as written/.test(text)) return text.trim(); }
    return null;
  })()`);
  check(`[${locale}] la advertencia del prompt de pasada se ve`, hint !== null, hint ? hint.slice(0, 70) : null);
  check(`[${locale}] sale del catálogo (pseudo-locale)`, Boolean(hint && hint.includes("⟦")), hint ? hint.slice(0, 12) : null);
}
await evaluate(`window.localStorage.setItem('pl.uiLanguage','en'); window.localStorage.removeItem('pl.debugPseudoLocale')`);
ws.close();
console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
