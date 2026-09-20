# i18n — acceptance harnesses

Runnable checks that exercise the interface language through the real app in a real browser, same
convention as `scripts/memory-acceptance/`.

## Prerequisites

```bash
cd backend && npm run dev     # API on :3001
cd frontend && npm run dev    # UI on :5173, proxying /api to :3001
```

`01-ui-language.mjs` opens its own headless Chromium on port 9224 when there is none listening, so
there is nothing to launch by hand. If you already have one there, it uses yours.

## Running

```bash
node scripts/i18n-acceptance/01-ui-language.mjs   # selector, `<html lang>`, persistence, pseudo-locale
node scripts/i18n-acceptance/02-ui-coverage.mjs   # every screen in English, pseudo-locale: what is left untranslated
node scripts/i18n-acceptance/03-api-errors.mjs    # the backend's error codes come out translated
node scripts/i18n-acceptance/04-recast-language-hint.mjs   # the note on a Recast pass prompt
node scripts/i18n-acceptance/05-recast-pass-pins-language.mjs   # that a pinned pass really wins
```

Each script exits non-zero if any check fails and prints one `PASS`/`FAIL` line per check.

`02-ui-coverage.mjs` walks 20 screens (shell, both menus, every top-bar panel and the chat itself
with its Vista menu and Memoria Viva panel), seeds its own chat and deletes it at the end. It reports
every visible string that did not come from the catalog and fails when one of them looks Spanish.
Text that is deliberately not translated (native language names, slash commands, units, the product
name) and the user's own data, which the interface marks with `data-user-data`, are excluded.

Five screens list the user's own collections (lorebooks, presets, personas, rules, recast presets).
They are reported but never fail the run: from the DOM, a lorebook entry written in Spanish and an
untranslated label look exactly the same, so those lists are for a human to skim. On a clean install
they report nothing.

`04-recast-language-hint.mjs` opens the Recast panel, opens a preset and reads the note under the
pass prompt in both locales. It exists because a Recast pass is sent to the model exactly as
written: if its text pins a language, that rule beats the configured output language, and the person
writing the prompt is the only one who can decide about it.

`05-recast-pass-pins-language.mjs` spends a couple of model calls on purpose: it proves that a pass
whose text pins a language beats `outputLanguage`, which is the whole reason the note exists. Skip it
if no provider is configured; it reports `SKIP` instead of failing.

`03-api-errors.mjs` needs no browser: it asks the API for real failures, runs the real mapper
against those responses in both locales, and checks that every code the backend can send has a
translation and no code is translated that the backend never sends.

The three markers the interface uses to tell content apart from copy, and that `02` honours:

| Marker | Meaning |
| --- | --- |
| `data-user-data` | the person's own text: chat titles, character names, their lorebooks |
| `data-prompt-content` | text that travels to the model, such as the Director's system prompt |
| the catalog | everything else, which the pseudo-locale wraps in ⟦…⟧ |

Form controls are skipped as well: a textarea holds what is being edited, never a label. The
Director and ComfyInject panels sometimes show one extra unmarked string that comes and goes between
runs (their own state is fetched in the background); the walk reports it, it never looks Spanish, and
it is informational rather than a failure.

Both browser scripts run against the Vite dev server by default. Point them at the build the backend serves
with `I18N_BASE`:

```bash
I18N_BASE=http://localhost:3001 node scripts/i18n-acceptance/02-ui-coverage.mjs
```

## Alongside the harness

```bash
cd frontend && npm run i18n:check   # catalog parity, key usage, hardcoded copy, migration progress
cd frontend && npm run build        # tsc fails if a catalog key is missing in another locale
```

`npm run i18n:check` is the cheap loop; the browser harness is the one that proves a real user can
switch languages. `01-ui-language.mjs` restores whatever language preference the browser had before
it ran.
