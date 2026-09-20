/**
 * Acceptance for the interaction the pass-prompt hint warns about.
 *
 * A Recast pass is sent to the model exactly as written. This proves the consequence with real
 * model calls: with `outputLanguage` set to English, a pass whose own text pins Spanish still comes
 * back in Spanish. That is why the interface says so under the prompt field instead of letting the
 * person discover it by reading a Spanish reply in an English chat.
 *
 * Costs a few model calls (one per case), so it is not part of the default loop.
 */
const BASE = process.env.I18N_BASE ?? "http://127.0.0.1:3001";
const json = (response) => response.json();

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

const settings = await fetch(`${BASE}/api/settings`).then(json);
const original = settings.outputLanguage;

const TEXT =
  "Mira closed the door behind her and let out a breath she had been holding since the bridge. The room smelled of rain and old paper.";
const PINNED_PASS = {
  passId: "probe",
  systemPrompt:
    "You are a prose editor. Fix the text inside <text_to_transform>.\n## Language (hard rule)\nAll narration and all spoken dialogue in your output must be in Spanish. Never output English prose.\nReturn only the corrected text.",
  userPrefix: `<text_to_transform>\n${TEXT}\n</text_to_transform>`,
};
const LOOKS_SPANISH = /\b(el|la|los|las|una|de|que|con|sus|del|por|para|es|su|al|cerró|exhaló|soltó|puerta|habitación)\b/i;

/** Runs one pass and returns what came back, or null when the provider did not answer. */
async function runPass(outputLanguage) {
  await fetch(`${BASE}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...settings, outputLanguage }),
  });
  const started = Date.now();
  const response = await fetch(`${BASE}/api/recast/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: TEXT, passes: [PINNED_PASS] }),
  });
  if (!response.ok) return null;
  const body = await response.json();
  return { text: (body.text ?? "").trim(), ms: Date.now() - started };
}

try {
  const english = await runPass("English");
  if (english === null) {
    console.log("SKIP: the provider did not answer, so the interaction cannot be observed");
    process.exit(0);
  }
  check("the pass actually ran (it changed the text)", english.text !== TEXT, { ms: english.ms });
  check(
    "with outputLanguage=English, a pass that pins Spanish still answers in Spanish",
    LOOKS_SPANISH.test(english.text.slice(0, 200)),
    english.text.slice(0, 120),
  );
} finally {
  await fetch(`${BASE}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...settings, outputLanguage: original }),
  });
  const restored = await fetch(`${BASE}/api/settings`).then(json);
  check("the configured output language was restored", JSON.stringify(restored.outputLanguage) === JSON.stringify(original), restored.outputLanguage);
}

console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
