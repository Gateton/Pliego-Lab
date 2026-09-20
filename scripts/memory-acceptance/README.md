# Memoria Viva acceptance harnesses

Runnable checks that exercise the feature through its real interfaces (the HTTP API and a real
browser), not through mocks.

## Prerequisites

```bash
cd backend && npm run dev     # API on :3001
cd frontend && npm run dev    # UI on :5173, proxying /api to :3001
```

For the UI harnesses, Chromium must be listening on the DevTools port they expect
(`--remote-debugging-port=9224`). The scripts create their own chat, run, and delete it, so the real
data of the app is never modified.

## Running

```bash
node scripts/memory-acceptance/01-api-core.mjs          # Phase 1 surface
node scripts/memory-acceptance/02-api-full-design.mjs   # every gap of the full design
node scripts/memory-acceptance/03-ui-core.mjs           # chat header, panel, toggle
node scripts/memory-acceptance/04-ui-full-design.mjs    # all panel tabs and settings
node scripts/memory-acceptance/05-ui-invalidation.mjs   # editing a message invalidates memory
```

Each script exits non-zero if any check fails and prints one `PASS`/`FAIL` line per check.

## Extraction quality

The extractor's labeled benchmark is separate because it measures precision rather than behavior:

```bash
cd backend && npx tsx ../scripts/memory-acceptance/06-extraction-quality.ts --verbose
```

Each case declares what **must** be extracted and what **must** be rejected (image markers,
rhetorical questions, and garbage entities). The verdict contains three numbers: precision, recall,
and perfect cases. In this domain, precision matters more than recall: an incorrect memory is
injected as canon in the next turn, while an omission only loses context.

Alongside these, the unit suites cover the engine itself:

```bash
cd backend && npm test        # store, extraction, retrieval, compilation, guard, scope
cd frontend && npm run build && npm run lint
```
