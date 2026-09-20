#!/usr/bin/env node
/**
 * Guard for the interface translation. Run with `npm run i18n:check`.
 *
 * The npm script runs this file through `tsx` because Node 20 does not load `.ts` files directly.
 * The checker adds no runtime dependency beyond the existing TypeScript tooling.
 *
 * It reads the source through the TypeScript AST rather than by pattern matching. Comments and
 * string literals are different nodes, so commented-out copy can never be mistaken for real copy,
 * and a multi-line JSDoc block cannot be mistaken for JSX text. `typescript` is already a devDep.
 *
 * What it checks:
 *   1. Both catalogs carry the same keys, all with a non-empty value. (`tsc` already enforces this
 *      through `satisfies`; the script re-checks because it also runs on its own.)
 *   2. Every `namespace.some.key` literal in the source exists in the reference catalog. This is
 *      the rule that catches a typo inside an indirection map such as `Record<Locale, TranslationKey>`,
 *      where `tsc` only sees `string`.
 *   3. No catalog key is left unreferenced. Warning only: a key can land one commit before the
 *      component that uses it.
 *   4. Files listed in MIGRATED_FILES carry no hardcoded visible copy: JSX text, a string in a
 *      copy-carrying prop, or a template literal used as JSX content. This is the rule that stops
 *      the next feature from quietly reintroducing Spanish.
 *   5. How much of the interface is migrated, as a number.
 *
 * Known boundary: a copy string built at runtime from a variable (`t(someVariable)`) is invisible
 * to rule 2 by construction. That is why the type of `t` only accepts catalog keys.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { CATALOGS, flattenCatalog } from "../src/i18n/catalog.ts";
import { LOCALES } from "../src/i18n/types.ts";

const FRONTEND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ROOT = join(FRONTEND_ROOT, "src");
const LOCALES_ROOT = join(SRC_ROOT, "i18n", "locales");

const REFERENCE_LOCALE = LOCALES[0];
const referenceFlat = flattenCatalog(REFERENCE_LOCALE);
const NAMESPACES = Object.keys(CATALOGS[REFERENCE_LOCALE]);

/**
 * Files whose copy already comes from the catalog. Hardcoded visible text in one of these is an
 * error. Add the file here in the same commit that migrates it, never afterwards.
 */
const MIGRATED_FILES: string[] = [
  "src/App.tsx",
  "src/api/activeMemory.ts",
  "src/api/chatStream.ts",
  "src/api/lorebooks.ts",
  "src/components/ChatGalleryModal.tsx",
  "src/components/ChatVariablesModal.tsx",
  "src/components/ChatView.tsx",
  "src/components/Composer.tsx",
  "src/components/ConfigOverlay.tsx",
  "src/components/ErrorBoundary.tsx",
  "src/components/LeftPanel.tsx",
  "src/components/LeftSidebar.tsx",
  "src/components/MessageBubble.tsx",
  "src/components/RecastDiffModal.tsx",
  "src/components/RightPanel.tsx",
  "src/components/TopBar.tsx",
  "src/components/TurnEventDetailModal.tsx",
  "src/components/characters/CharacterCreator.tsx",
  "src/components/characters/CharacterEditor.tsx",
  "src/components/chat/ChatOptionsMenu.tsx",
  "src/components/director/VisualStatePanel.tsx",
  "src/components/estudio/EstudioPanel.tsx",
  "src/components/estudio/LibraryEditor.tsx",
  "src/components/estudio/RulesPanel.tsx",
  "src/components/gateton-roleplay/GatetonRoleplay.tsx",
  "src/components/gateton-roleplay/modules/DirectorModule.tsx",
  "src/components/gateton-roleplay/modules/PlumaModule.tsx",
  "src/components/lorebooks/LorebookStudio.tsx",
  "src/components/memory/ActiveMemoryPanel.tsx",
  "src/components/memory/CanonTab.tsx",
  "src/components/memory/EpisodesTab.tsx",
  "src/components/memory/KnowledgeTab.tsx",
  "src/components/memory/NowTab.tsx",
  "src/components/memory/RevisionsTab.tsx",
  "src/components/memory/SettingsTab.tsx",
  "src/components/memory/ThreadsTab.tsx",
  "src/components/memory/TimelineTab.tsx",
  "src/components/memory/UsedTab.tsx",
  "src/components/memory/memoryAction.ts",
  "src/components/memory/memoryBits.tsx",
  "src/components/memory/memoryFormat.ts",
  "src/components/npc/DossierFieldInput.tsx",
  "src/components/npc/NpcRosterPanel.tsx",
  "src/components/npc/NpcTrackerSettingsPanel.tsx",
  "src/components/onboarding/FirstRunWizard.tsx",
  "src/components/onboarding/FirstStepsCard.tsx",
  "src/components/onboarding/GuideSettings.tsx",
  "src/components/onboarding/HelpMenu.tsx",
  "src/components/onboarding/features.ts",
  "src/components/personas/PersonaManager.tsx",
  "src/components/presets/RecastPresetManager.tsx",
  "src/components/presets/SamplingPresetManager.tsx",
  "src/components/settings/ComfyInjectSettings.tsx",
  "src/components/settings/LanguageSettings.tsx",
  "src/components/settings/MemoryOverview.tsx",
  "src/components/settings/ModelSelect.tsx",
  "src/components/settings/ProviderConnectionPanel.tsx",
  "src/components/settings/RecastSettings.tsx",
  "src/components/settings/SillyTavernImportPanel.tsx",
  "src/components/settings/ThemeGrid.tsx",
  "src/components/settings/ThemeSettings.tsx",
  "src/components/tour/OnboardingTour.tsx",
  "src/components/tour/tourSteps.ts",
  "src/components/ui/Modal.tsx",
  "src/components/ui/NumberSlider.tsx",
  "src/components/usage/UsageDashboard.tsx",
  "src/hooks/useActiveMemory.ts",
  "src/hooks/useChat.ts",
  "src/hooks/useProviderModels.ts",
  "src/hooks/useProviders.ts",
  "src/lib/composerCommands.ts",
  "src/lib/npcTracker.ts",
  "src/lib/recastDefaults.ts",
  "src/lib/themes.ts",
];

/**
 * Props and object keys whose value is read by a human. Keep the list tight: every entry widens the
 * guard. The object-key half is what catches label maps such as `TABS = [{ label: "General" }]` and
 * `APP_THEMES = [{ name, description }]`, where the copy never appears as JSX text.
 */
const COPY_ATTRIBUTES = new Set(["label", "title", "hint", "placeholder", "description", "aria-label", "alt", "tooltip", "blurb"]);

/**
 * Object keys whose value is copy. Wider than the attribute list on purpose: `{ name: "Gateton" }`
 * in a data map is a label, while `name="merge-survivor"` on an input is a form field id.
 */
const COPY_KEYS = new Set([...COPY_ATTRIBUTES, "name", "text", "message", "empty", "error"]);

/** Serialized character-card metadata is not interface copy, even when it reads like a label. */
const NON_UI_LITERAL_KEYS = new Set(["creator"]);

/**
 * A literal that reads like a sentence rather than an identifier or a class list: two or more words
 * of two or more letters, and none of the punctuation that only ever shows up in code.
 *
 * This is a heuristic and it is deliberately the conservative direction: an English class name or a
 * MIME type is never reported, and the price is that a single-word label (`"General"`) can slip
 * through unless it sits in a copy-carrying prop or key. The pseudo-locale audit
 * (`pl.debugPseudoLocale=1`) is what closes that gap before a release.
 */
function looksLikeCopy(text: string): boolean {
  if (/[-_#{}<>|;=]/.test(text)) return false;
  const words = text.split(/\s+/).filter((word) => /\p{L}{2}/u.test(word));
  return words.length >= 2;
}

/**
 * Files with no interface copy at all, even though they contain long string literals. Each one needs
 * a reason: this is not an escape hatch for a file that is inconvenient to migrate.
 */
const EXEMPT_FILES: Record<string, string> = {
  "src/lib/comfyInjectPrompt.ts": "default image directive sent to ComfyUI, never shown as interface copy",
  "src/lib/presetDefaults.ts": "code-level fallback preset that is never listed on screen, so its name is a data placeholder",
  "src/types/pluma.ts": "English-only prompt templates sent to the model, not interface copy",
};

/**
 * Text that is legitimately a literal inside a migrated file. Every entry is a hole in the guard, so
 * it has to be justified in a comment.
 */
const ALLOWED_LITERALS = new Set([
  // Product name: identical in every language.
  "Pliego Lab",
  // Language names are shown in their own language, never translated.
  "Español",
  "English",
  // Dice macro syntax: it is what the model receives, not text a person reads.
  "[[dice]]",
  "dice",
  // The output-language picker names every language in its own language.
  "Français",
  "Português",
  "Deutsch",
  "Italiano",
  "日本語",
]);

type Severity = "error" | "warning";

interface Finding {
  severity: Severity;
  location: string;
  detail: string;
}

const findings: Finding[] = [];

function report(severity: Severity, location: string, detail: string): void {
  findings.push({ severity, location, detail });
}

function sourceFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") walk(path);
      } else if (/\.tsx?$/.test(entry.name)) {
        files.push(path);
      }
    }
  };
  walk(SRC_ROOT);
  return files;
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

function parseText(file: string, text: string): ts.SourceFile {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

/** The committed version of a file, or null when the file is new in this change. */
function committedSource(relativePath: string): string | null {
  try {
    return execFileSync("git", ["show", `HEAD:${relativePath}`], { cwd: FRONTEND_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

/** A piece of visible copy found in a source file, with the line it sits on. */
interface Candidate {
  line: number;
  text: string;
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

/**
 * Visible copy in one file. Only three shapes matter: JSX text, a copy-carrying prop, and a
 * template literal rendered as JSX content. Everything else in a component (class names, keys,
 * event names) is not copy and is never reported.
 */
function candidatesIn(sourceFile: ts.SourceFile, strict = false): Candidate[] {
  const found: Candidate[] = [];
  const seen = new Set<string>();
  const push = (node: ts.Node, text: string): void => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const line = lineOf(sourceFile, node);
    const identity = `${line}:${trimmed}`;
    if (seen.has(identity)) return;
    seen.add(identity);
    found.push({ line, text: trimmed });
  };
  const visit = (node: ts.Node, parent: ts.Node | undefined, inConsole: boolean): void => {
    const isNonUiLiteral =
      (ts.isPropertyAssignment(node) && NON_UI_LITERAL_KEYS.has(propertyKey(node))) ||
      (parent !== undefined && ts.isPropertyAssignment(parent) && NON_UI_LITERAL_KEYS.has(propertyKey(parent)));
    if (isNonUiLiteral) {
      // Character-card metadata travels inside exported PNG/JSON cards; it is not rendered by the UI.
    } else if (ts.isJsxText(node)) {
      const text = node.text.trim();
      if (/\p{L}{2}/u.test(text)) push(node, text);
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer) && COPY_ATTRIBUTES.has(node.name.getText(sourceFile))) {
      push(node.initializer, node.initializer.text);
    } else if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.initializer) && COPY_KEYS.has(propertyKey(node))) {
      // Label maps: `{ id: "general", label: "General" }`, `{ name, description }` in APP_THEMES.
      push(node.initializer, node.initializer.text);
    } else if (ts.isJsxExpression(node) && node.expression && ts.isTemplateExpression(node.expression) && !(parent && ts.isJsxAttribute(parent))) {
      // Only when the template is JSX content. As an attribute it is almost always a class name or
      // an aria id, which is not copy.
      const parts = [node.expression.head.text, ...node.expression.templateSpans.map((span) => span.literal.text)].join(" ");
      if (/\p{L}{2}/u.test(parts)) push(node, parts);
    } else if (!strict && !inConsole && ts.isStringLiteral(node) && looksLikeCopy(node.text)) {
      push(node, node.text);
    }
    // Diagnostics go to the console, not to the screen: `console.warn("Memoria Viva is off")` is
    // for whoever reads the devtools, and translating it would only make bugs harder to search.
    const isConsoleCall =
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "console";
    ts.forEachChild(node, (child) => visit(child, node, inConsole || isConsoleCall));
  };
  visit(sourceFile, undefined, false);
  return found;
}

function propertyKey(node: ts.PropertyAssignment): string {
  const name = node.name;
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name)) return name.text;
  return "";
}

function isKeyLike(text: string): boolean {
  return new RegExp(`^(?:${NAMESPACES.join("|")})(?:\\.[A-Za-z0-9]+)+$`).test(text);
}

// --- 1. Catalog parity -------------------------------------------------------------------------

const catalogs = LOCALES.map((locale) => ({ locale, flat: flattenCatalog(locale) }));

for (const { locale, flat } of catalogs) {
  for (const [key, value] of flat) {
    if (!value.trim()) report("error", `${locale}:${key}`, "the translation is empty");
  }
  if (locale === REFERENCE_LOCALE) continue;
  for (const key of referenceFlat.keys()) {
    if (!flat.has(key)) report("error", `${locale}:${key}`, `missing, present in the ${REFERENCE_LOCALE} catalog`);
  }
  for (const key of flat.keys()) {
    if (!referenceFlat.has(key)) report("error", `${locale}:${key}`, `not present in the ${REFERENCE_LOCALE} catalog`);
  }
  // A value that kept Spanish-only characters is almost always a translation nobody finished.
  for (const [key, value] of flat) {
    if (value === referenceFlat.get(key)) continue;
    if (/[¿¡ñ]/i.test(value)) report("warning", `${locale}:${key}`, `looks untranslated: ${JSON.stringify(value)}`);
  }
}

// --- 2 and 3. Keys referenced in the source, and keys never referenced --------------------------

/**
 * Backend error codes are dot-paths too (`director.disabled`), so a scan for "literals that look
 * like catalog keys" would read them as missing translations. Knowing the codes lets the scan skip
 * exactly those literals and nothing else.
 */
/** Property names of an exported object literal, read without importing the module. */
function objectKeyList(file: string, exportName: string): string[] {
  if (!statSync(file, { throwIfNoEntry: false })) return [];
  const keys: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === exportName) {
      let initializer = node.initializer;
      if (initializer && ts.isAsExpression(initializer)) initializer = initializer.expression;
      if (initializer && ts.isObjectLiteralExpression(initializer)) {
        for (const property of initializer.properties) {
          if (ts.isPropertyAssignment(property)) keys.push(propertyKey(property));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(file));
  return keys;
}

const errorCodes = new Set([...objectKeyList(join(FRONTEND_ROOT, "..", "backend", "src", "services", "apiError.ts"), "API_ERRORS"), ...objectKeyList(join(SRC_ROOT, "i18n", "apiErrors.ts"), "API_ERROR_KEYS")]);

const referenced = new Set<string>();
const sources = sourceFiles().filter((file) => !file.startsWith(LOCALES_ROOT));
const considered = sources.filter((file) => !(relative(FRONTEND_ROOT, file) in EXEMPT_FILES));

for (const file of sources) {
  const sourceFile = parse(file);
  const location = relative(FRONTEND_ROOT, file);
  const visit = (node: ts.Node, parent?: ts.Node): void => {
    // A quoted property name is not a reference to a key: `{ "usage.openRouterOnly": "..." }` names
    // a backend error code, and the code happens to look like a catalog path.
    const isPropertyName = parent !== undefined && ts.isPropertyAssignment(parent) && parent.name === node;
    // A literal that is a known backend code, and not a key of its own, is not a reference either.
    const isErrorCodeOnly = ts.isStringLiteral(node) && errorCodes.has(node.text) && !referenceFlat.has(node.text);
    if (!isPropertyName && !isErrorCodeOnly && ts.isStringLiteral(node) && isKeyLike(node.text)) {
      referenced.add(node.text);
      if (!referenceFlat.has(node.text)) {
        report("error", `${location}:${lineOf(sourceFile, node)}`, `"${node.text}" is not in the ${REFERENCE_LOCALE} catalog`);
      }
    }
    ts.forEachChild(node, (child) => visit(child, node));
  };
  visit(sourceFile);
}

/** `key_one` / `key_other` are picked at runtime from the base key, never written out. */
const PLURAL_VARIANT = /_(?:zero|one|two|few|many|other)$/;

for (const key of referenceFlat.keys()) {
  if (referenced.has(key)) continue;
  const base = key.replace(PLURAL_VARIANT, "");
  if (base !== key && referenced.has(base)) continue;
  report("warning", key, "no file references this key");
}

// --- 4. No hardcoded copy in migrated files ----------------------------------------------------

for (const relativePath of MIGRATED_FILES) {
  const sourceFile = parse(join(FRONTEND_ROOT, relativePath));
  for (const { line, text } of candidatesIn(sourceFile)) {
    if (ALLOWED_LITERALS.has(text)) continue;
    report("error", `${relativePath}:${line}`, `hardcoded copy: ${JSON.stringify(text)}`);
  }
  // Two honest cases end up registered without quoting a key: a file whose copy moved to the catalog
  // but is resolved elsewhere (`lib/themes.ts` holds ids, the picker builds the key from them) and a
  // file that turned out to have no copy at all, which belongs in EXEMPT_FILES. Worth a look, not a
  // failure: this is the one place where the registry is a judgement call rather than a fact.
  let readsCatalog = false;
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) && isKeyLike(node.text) && referenceFlat.has(node.text)) readsCatalog = true;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (!readsCatalog) report("warning", relativePath, "registered as migrated but it never quotes a catalog key: either the key is built elsewhere or it belongs in EXEMPT_FILES");
}

// --- 5. Backend error codes and their translations stay in step -------------------------------

const backendCodes = objectKeyList(join(FRONTEND_ROOT, "..", "backend", "src", "services", "apiError.ts"), "API_ERRORS");
const frontendCodes = objectKeyList(join(SRC_ROOT, "i18n", "apiErrors.ts"), "API_ERROR_KEYS");
for (const code of backendCodes) {
  if (!frontendCodes.includes(code)) report("error", `apiErrors.ts:${code}`, "the backend sends this code and the interface has no translation for it");
}
for (const code of frontendCodes) {
  if (!backendCodes.includes(code)) report("error", `apiErrors.ts:${code}`, "translated here but the backend never sends it");
}

// --- 6. Files with copy that are not registered yet, and progress -----------------------------

/**
 * The two rules only close the loop together: a registered file may not carry hardcoded copy
 * (rule 4), and a file that carries copy has to be registered (this rule). Between them, copy
 * outside the catalog cannot come back: either it lands in a registered file and fails rule 4, or
 * it lands in a new file and fails this one.
 */
function countCandidates(file: string): number {
  return candidatesIn(parse(file)).length;
}

const pending = considered.filter((file) => countCandidates(file) > 0 && !MIGRATED_FILES.includes(relative(FRONTEND_ROOT, file)));
for (const file of pending) {
  report("error", relative(FRONTEND_ROOT, file), `${countCandidates(file)} hardcoded string(s) in a file that is not registered in MIGRATED_FILES`);
}

const migrated = MIGRATED_FILES.length;
const total = migrated + pending.length;
const percent = total === 0 ? 100 : Math.round((migrated / total) * 100);

// --- Output -----------------------------------------------------------------------------------

/**
 * `npm run i18n:check -- --list [path]` prints every piece of visible copy with its line, which is
 * what the migration actually works from. Without a path it lists the whole source tree.
 */
const listTarget = process.argv.indexOf("--list");
if (listTarget !== -1) {
  const requested = process.argv[listTarget + 1];
  const target = requested ? resolve(FRONTEND_ROOT, requested) : null;
  const files = target === null ? considered : statSync(target).isDirectory() ? considered.filter((file) => file.startsWith(target)) : [target];
  let total = 0;
  for (const file of files) {
    const candidates = candidatesIn(parse(file));
    if (candidates.length === 0) continue;
    console.log(`\n${relative(FRONTEND_ROOT, file)}  (${candidates.length})`);
    for (const { line, text } of candidates) console.log(`  ${String(line).padStart(4)}  ${text}`);
    total += candidates.length;
  }
  console.log(`\n${total} candidate(s) in ${files.length} file(s).`);
  process.exit(0);
}

/**
 * `npm run i18n:check -- --spanish-review` proves the migration did not rewrite the Spanish: it takes
 * the copy that was hardcoded in the committed version of every migrated file and checks that it
 * still exists somewhere in the Spanish catalog. Sentences split around interpolations or markup are
 * matched as fragments, so the check tolerates restructuring but not rewording.
 */
const reviewTarget = process.argv.indexOf("--spanish-review");
if (reviewTarget !== -1) {
  const normalize = (text: string): string => text.replace(/\s+/g, " ").trim();
  const values = [...referenceFlat.values()].map(normalize);
  // Every file the change touched, not just the ones already registered in MIGRATED_FILES: the
  // point is to check the whole migration, including the part that is still being wired.
  const repoPrefix = execFileSync("git", ["rev-parse", "--show-prefix"], { cwd: FRONTEND_ROOT, encoding: "utf8" }).trim();
  const changed = execFileSync("git", ["diff", "--name-only", "HEAD"], { cwd: FRONTEND_ROOT, encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /\.tsx?$/.test(line) && line.startsWith(repoPrefix))
    .filter((line) => !line.startsWith(`${repoPrefix}src/i18n/locales/`) && !line.startsWith(`${repoPrefix}scripts/`));
  let checked = 0;
  let unmatched = 0;
  for (const relativePath of changed) {
    const committed = committedSource(relativePath);
    if (committed === null) continue;
    const lost: string[] = [];
    for (const candidate of candidatesIn(parseText(relativePath, committed), true)) {
      const text = normalize(candidate.text);
      if (text.length < 6 || ALLOWED_LITERALS.has(text)) continue;
      checked += 1;
      const found = values.some((value) => value.includes(text) || text.includes(value));
      if (!found) lost.push(`line ${candidate.line}: ${JSON.stringify(text)}`);
    }
    if (lost.length > 0) {
      unmatched += lost.length;
      console.log(`\n${relativePath.startsWith(repoPrefix) ? relativePath.slice(repoPrefix.length) : relativePath}`);
      for (const line of lost) console.log(`  ${line}`);
    }
  }
  console.log(`\n${checked - unmatched}/${checked} committed strings still present in the ${REFERENCE_LOCALE} catalog.`);
  if (unmatched > 0) {
    console.log(`\n${unmatched} string(s) disappeared or were rewritten.`);
    process.exitCode = 1;
  } else {
    console.log("\nOK: the Spanish copy is unchanged.");
  }
  process.exit(process.exitCode ?? 0);
}

const errors = findings.filter((finding) => finding.severity === "error");
const warnings = findings.filter((finding) => finding.severity === "warning");

function printGroup(title: string, items: Finding[]): void {
  if (items.length === 0) return;
  console.log(`\n${title} (${items.length})`);
  for (const item of items) console.log(`  ${item.location}  ${item.detail}`);
}

console.log(`i18n check — locales: ${LOCALES.join(", ")} — keys: ${referenceFlat.size} — parsed files: ${sources.length}`);
printGroup("ERRORS", errors);
printGroup("WARNINGS (never fail the check)", warnings);
console.log(`\nMigrated: ${migrated}/${total} UI files (${percent}%). Pending: ${pending.length}.`);

if (errors.length > 0) {
  console.log(`\n${errors.length} error(s). The interface migration is not complete.`);
  process.exitCode = 1;
} else {
  console.log("\nOK.");
}
