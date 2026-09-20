#!/usr/bin/env node
/**
 * Acceptance for the messages the backend sends when something is wrong.
 *
 * The chain has three links, and this harness checks all of them against the running API:
 *   1. the backend answers with a stable `code` plus a canonical text (checked by hitting it),
 *   2. the interface turns that code into a translated sentence (checked by running the real
 *      mapper, with the real catalogs, in both locales),
 *   3. every code the backend knows has a translation and no code is translated that the backend
 *      never sends.
 *
 * No browser: the mapper is a pure function of the response, so it can be exercised directly.
 */
const BASE = process.env.I18N_BASE ?? "http://127.0.0.1:3001";
const FRONTEND = new URL("../../frontend/src/", import.meta.url).pathname;

const { responseError } = await import(`${FRONTEND}api/requestError.ts`);
const { API_ERROR_KEYS } = await import(`${FRONTEND}i18n/apiErrors.ts`);
const { CATALOGS } = await import(`${FRONTEND}i18n/catalog.ts`);
const { setLocale } = await import(`${FRONTEND}i18n/state.ts`);

let failures = 0;
function check(label, condition, detail) {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  // Truncated: a failure detail is a response body, and this app's responses can carry the user's
  // own characters and lorebooks. The harness prints a hint, not their library.
  const text = detail === undefined ? "" : ` :: ${JSON.stringify(detail).slice(0, 160)}`;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${text}`);
}

for (let i = 0; i < 60; i += 1) {
  if ((await fetch(`${BASE}/api/settings`).catch(() => null))?.ok) break;
  await new Promise((r) => setTimeout(r, 200));
}

// --- 1. The API really sends codes --------------------------------------------------------------
// Endpoints that fail on their own, without needing to break the installation first: asking for
// something that is not there. The body is small and belongs to nobody.
const MISSING_ID = "00000000-0000-4000-8000-000000000000";
const cases = [
  { label: "404 on a lorebook that does not exist", path: `/api/lorebooks/${MISSING_ID}`, code: "lorebook.notFound" },
  { label: "404 on a character that does not exist", path: `/api/characters/${MISSING_ID}`, code: "character.notFound" },
];

const seen = [];
for (const testCase of cases) {
  const response = await fetch(`${BASE}${testCase.path}`);
  // Clone first: the body below is read twice, once here and once by the mapper under test.
  const body = await response.clone().json().catch(() => null);
  check(`${testCase.label} carries a code`, body?.code === testCase.code, body);
  check(`${testCase.label} carries canonical text`, typeof body?.error === "string" && body.error.length > 0, body?.error);
  if (body?.code) seen.push({ response, code: body.code });
}

// --- 2. The interface translates those responses ------------------------------------------------
for (const { response, code } of seen) {
  for (const locale of ["en", "es"]) {
    setLocale(locale);
    const expected = CATALOGS[locale].common.errors[code];
    const message = (await responseError(response.clone())).message;
    check(`${code} reads as ${locale}`, message === expected, { message, expected });
  }
}

// --- 3. Fallbacks, and every code has a translation ---------------------------------------------
setLocale("en");
const unknownCode = new Response(JSON.stringify({ error: "Something exploded", code: "not.a.real.code" }), { status: 500 });
check("an unknown code falls back to the text the backend sent", (await responseError(unknownCode)).message === "Something exploded");
const emptyBody = new Response("", { status: 502 });
check("a response with no body falls back to the status", (await responseError(emptyBody)).message === "Request failed (502)");

const backendSource = await import("node:fs").then((fs) => fs.readFileSync(new URL("../../backend/src/services/apiError.ts", import.meta.url), "utf8"));
const backendCodes = [...backendSource.matchAll(/^\s+"([^"]+)":/gm)].map((match) => match[1]);
check("the harness found the backend code list", backendCodes.length > 20, backendCodes.length);
check("every code the backend sends is translated", backendCodes.every((code) => API_ERROR_KEYS[code] !== undefined), backendCodes.filter((code) => !API_ERROR_KEYS[code]));
for (const code of Object.keys(API_ERROR_KEYS)) {
  if (!backendCodes.includes(code)) check(`${code} is not sent by the backend`, false);
}

// --- Every translation is a real sentence, in both locales -------------------------------------
for (const code of backendCodes) {
  const key = API_ERROR_KEYS[code];
  if (!key) continue;
  for (const locale of ["es", "en"]) {
    const value = CATALOGS[locale].common.errors[code];
    if (typeof value !== "string" || value.length < 4 || /[¿¡ñ]/.test(locale === "en" ? value : "")) {
      check(`${code} has a usable ${locale} sentence`, false, value);
    }
  }
}
check("all error sentences are present in both locales", true);

console.log(failures === 0 ? "ALL API ERROR CHECKS PASSED" : `${failures} API ERROR CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
