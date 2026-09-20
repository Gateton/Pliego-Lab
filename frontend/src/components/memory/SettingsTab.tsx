import { Eye, Loader2, Save, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import type {
  ActiveMemorySettings,
  ActiveMemorySettingsPatch,
  MemoryBriefPreview,
  MemoryExtractionMode,
  MemoryExtractionReport,
  MemoryScope,
  SemanticRetrievalSettings,
} from "../../types/activeMemory";
import { useT } from "../../i18n";
import type { TFunction } from "../../i18n";
import { Alert, Button, Field, NumberSlider, Section, Toggle, inputClasses } from "../ui";
import { useMemoryAction } from "./memoryAction";
import {
  EXTRACTION_MODE_LABELS,
  GUARD_METHOD_LABELS,
  SKIPPED_FALLBACK,
  SKIPPED_LABELS,
  formatDate,
  isFiniteNumber,
} from "./memoryFormat";
import type { MemoryExtractionOutcome } from "./panelTypes";

interface Props {
  settings: ActiveMemorySettings;
  saving: boolean;
  knownNames: string[];
  onUpdateSettings?: (patch: ActiveMemorySettingsPatch) => Promise<void>;
  onRunExtraction?: (mode?: MemoryExtractionMode, options?: { all?: boolean }) => Promise<MemoryExtractionOutcome>;
  onPreviewBrief?: (query: string, responderId?: string) => Promise<MemoryBriefPreview>;
  lastExtractionReport?: MemoryExtractionReport | null;
}

const MODES: MemoryExtractionMode[] = ["auto", "heuristic", "llm"];

/** Everything the form owns, sent as one patch so a single save cannot half-apply. */
function toPatch(settings: ActiveMemorySettings): ActiveMemorySettingsPatch {
  return {
    enabled: settings.enabled,
    extractionMode: settings.extractionMode,
    model: settings.model,
    maxFacts: settings.maxFacts,
    maxThreads: settings.maxThreads,
    maxEpisodes: settings.maxEpisodes,
    maxBriefItems: settings.maxBriefItems,
    maxBriefCharacters: settings.maxBriefCharacters,
    briefBudgetPercent: settings.briefBudgetPercent,
    relateBudgetToContext: settings.relateBudgetToContext,
    semantic: { ...settings.semantic },
    scope: { ...settings.scope },
    deferVisualFactsToDirector: settings.deferVisualFactsToDirector,
  };
}

function signature(settings: ActiveMemorySettings): string {
  return JSON.stringify(toPatch(settings));
}

function validate(settings: ActiveMemorySettings, t: TFunction): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};
  if (!isFiniteNumber(settings.maxFacts) || settings.maxFacts < 1) errors.maxFacts = t("memory.settings.validation.min1");
  if (!isFiniteNumber(settings.maxThreads) || settings.maxThreads < 1) errors.maxThreads = t("memory.settings.validation.min1");
  if (!isFiniteNumber(settings.maxEpisodes) || settings.maxEpisodes < 1) errors.maxEpisodes = t("memory.settings.validation.min1");
  if (!isFiniteNumber(settings.maxBriefItems) || settings.maxBriefItems < 1) errors.maxBriefItems = t("memory.settings.validation.min1");
  if (!isFiniteNumber(settings.maxBriefCharacters) || settings.maxBriefCharacters < 500) {
    errors.maxBriefCharacters = t("memory.settings.validation.min500");
  }
  if (!isFiniteNumber(settings.briefBudgetPercent) || settings.briefBudgetPercent < 1 || settings.briefBudgetPercent > 50) {
    errors.briefBudgetPercent = t("memory.settings.validation.range150");
  }
  if (!isFiniteNumber(settings.semantic.minScore) || settings.semantic.minScore < 0 || settings.semantic.minScore > 1) {
    errors.semanticMinScore = t("memory.settings.validation.range01");
  }
  return errors;
}

function ExtractionSummary({ report }: { report: MemoryExtractionReport }) {
  const t = useT();
  return (
    <div className="rounded-md border border-border bg-bg p-3">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
        <span>
          {t("memory.settings.summaryHeader", {
            mode: t(EXTRACTION_MODE_LABELS[report.requestedMode]),
            method: t(GUARD_METHOD_LABELS[report.method]),
          })}
        </span>
        <span>{t("memory.settings.messageCount", { count: report.processedMessageIds.length })}</span>
        <span>{t("memory.settings.factsAdded", { added: report.addedFacts, updated: report.updatedFacts })}</span>
        <span>{t("memory.settings.threadsAdded", { added: report.addedThreads, updated: report.updatedThreads })}</span>
        <span>{t("memory.settings.episodesAdded", { added: report.addedEpisodes })}</span>
        {report.updatedScene && <span>{t("memory.settings.sceneUpdated")}</span>}
      </div>
      {report.warnings.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-warning">
          {report.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
        </ul>
      )}
    </div>
  );
}

export function SettingsTab({
  settings,
  saving,
  knownNames,
  onUpdateSettings,
  onRunExtraction,
  onPreviewBrief,
  lastExtractionReport,
}: Props) {
  const t = useT();
  // The draft carries the settings object it was derived from, so a fresh object from the server
  // (a save, a refresh) automatically replaces the draft instead of needing an effect.
  const [edit, setEdit] = useState<{ base: ActiveMemorySettings; draft: ActiveMemorySettings } | null>(null);
  const draft = edit && edit.base === settings ? edit.draft : settings;
  const dirty = edit !== null && edit.base === settings && signature(draft) !== signature(settings);
  const errors = validate(draft, t);

  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [extractionMode, setExtractionMode] = useState<MemoryExtractionMode | "settings">("settings");
  const [localExtraction, setLocalExtraction] = useState<MemoryExtractionOutcome | null>(null);
  const [previewQuery, setPreviewQuery] = useState("");
  const [previewResponder, setPreviewResponder] = useState("");
  const [preview, setPreview] = useState<MemoryBriefPreview | null>(null);

  const save = useMemoryAction(onUpdateSettings);
  const extract = useMemoryAction(onRunExtraction);
  const previewAction = useMemoryAction(onPreviewBrief);

  const report = lastExtractionReport ?? localExtraction?.report ?? null;
  const skipped = localExtraction?.skipped;

  function patchDraft(patch: Partial<ActiveMemorySettings>) {
    setSavedAt(null);
    setEdit({ base: settings, draft: { ...draft, ...patch } });
  }

  function patchSemantic(patch: Partial<SemanticRetrievalSettings>) {
    setSavedAt(null);
    setEdit({ base: settings, draft: { ...draft, semantic: { ...draft.semantic, ...patch } } });
  }

  function patchScope(patch: Partial<MemoryScope>) {
    setSavedAt(null);
    setEdit({ base: settings, draft: { ...draft, scope: { ...draft.scope, ...patch } } });
  }

  async function submit() {
    const outcome = await save.run(toPatch(draft));
    if (outcome.ok) {
      setEdit(null);
      setSavedAt(Date.now());
    }
  }

  async function runAllExtraction() {
    const outcome = await extract.run(
      extractionMode === "settings" ? undefined : extractionMode,
      { all: true },
    );
    if (outcome.ok) setLocalExtraction(outcome.value);
  }

  async function runPreview() {
    const outcome = await previewAction.run(previewQuery, previewResponder || undefined);
    if (outcome.ok) setPreview(outcome.value);
  }

  return (
    <div className="space-y-4">
      <Section title={t("memory.settings.general.title")} description={t("memory.settings.general.description")}>
        <Toggle
          id="memory-enabled"
          checked={draft.enabled}
          disabled={saving || save.busy}
          onChange={(checked) => patchDraft({ enabled: checked })}
          label={t("memory.shared.memoryEnabled")}
          hint={t("memory.settings.general.enabledHint")}
        />
        <Field
          label={t("memory.settings.general.extractionMode")}
          htmlFor="memory-mode"
          hint={t("memory.settings.general.extractionModeHint")}
        >
          <select
            id="memory-mode"
            value={draft.extractionMode}
            onChange={(event) => patchDraft({ extractionMode: event.target.value as MemoryExtractionMode })}
            className={inputClasses}
          >
            {MODES.map((mode) => <option key={mode} value={mode}>{t(EXTRACTION_MODE_LABELS[mode])}</option>)}
          </select>
        </Field>
        <Field
          label={t("memory.settings.general.extractionModel")}
          htmlFor="memory-model"
          hint={t("memory.settings.general.extractionModelHint")}
        >
          <input
            id="memory-model"
            type="text"
            value={draft.model}
            placeholder={t("memory.settings.general.extractionModelPlaceholder")}
            onChange={(event) => patchDraft({ model: event.target.value })}
            className={inputClasses}
          />
        </Field>
        <Toggle
          id="memory-defer-visual"
          checked={draft.deferVisualFactsToDirector}
          disabled={saving || save.busy}
          onChange={(checked) => patchDraft({ deferVisualFactsToDirector: checked })}
          label={t("memory.settings.general.deferVisual")}
          hint={t("memory.settings.general.deferVisualHint")}
        />
      </Section>

      <Section title={t("memory.settings.budget.title")} description={t("memory.settings.budget.description")}>
        <NumberSlider
          label={t("memory.settings.budget.maxFacts")}
          value={draft.maxFacts}
          min={1}
          max={400}
          step={1}
          onChange={(value) => patchDraft({ maxFacts: value ?? 1 })}
          hint={errors.maxFacts}
        />
        <NumberSlider
          label={t("memory.settings.budget.maxThreads")}
          value={draft.maxThreads}
          min={1}
          max={200}
          step={1}
          onChange={(value) => patchDraft({ maxThreads: value ?? 1 })}
          hint={errors.maxThreads}
        />
        <NumberSlider
          label={t("memory.settings.budget.maxEpisodes")}
          value={draft.maxEpisodes}
          min={1}
          max={200}
          step={1}
          onChange={(value) => patchDraft({ maxEpisodes: value ?? 1 })}
          hint={errors.maxEpisodes}
        />
        <NumberSlider
          label={t("memory.settings.budget.maxBriefItems")}
          value={draft.maxBriefItems}
          min={1}
          max={200}
          step={1}
          onChange={(value) => patchDraft({ maxBriefItems: value ?? 1 })}
          hint={errors.maxBriefItems}
        />
        <NumberSlider
          label={t("memory.settings.budget.maxBriefCharacters")}
          value={draft.maxBriefCharacters}
          min={500}
          max={50000}
          step={500}
          suffix={t("memory.settings.budget.characters")}
          onChange={(value) => patchDraft({ maxBriefCharacters: value ?? 500 })}
          hint={errors.maxBriefCharacters}
        />
        <NumberSlider
          label={t("memory.settings.budget.brief")}
          value={draft.briefBudgetPercent}
          min={1}
          max={50}
          step={1}
          suffix={t("memory.settings.budget.contextPercent")}
          onChange={(value) => patchDraft({ briefBudgetPercent: value ?? 1 })}
          hint={errors.briefBudgetPercent}
        />
        <Toggle
          id="memory-relate-budget"
          checked={draft.relateBudgetToContext}
          disabled={saving || save.busy}
          onChange={(checked) => patchDraft({ relateBudgetToContext: checked })}
          label={t("memory.settings.budget.relateToContext")}
          hint={t("memory.settings.budget.relateToContextHint")}
        />
      </Section>

      <Section title={t("memory.settings.semantic.title")} description={t("memory.settings.semantic.description")}>
        <Toggle
          id="memory-semantic"
          checked={draft.semantic.enabled}
          disabled={saving || save.busy}
          onChange={(checked) => patchSemantic({ enabled: checked })}
          label={t("memory.settings.semantic.title")}
          hint={t("memory.settings.semantic.hint")}
        />
        <Field label={t("memory.settings.semantic.model")} htmlFor="memory-semantic-model">
          <input
            id="memory-semantic-model"
            type="text"
            value={draft.semantic.model}
            placeholder={t("memory.settings.semantic.modelPlaceholder")}
            onChange={(event) => patchSemantic({ model: event.target.value })}
            className={inputClasses}
          />
        </Field>
        <NumberSlider
          label={t("memory.settings.semantic.minScore")}
          value={draft.semantic.minScore}
          min={0}
          max={1}
          step={0.05}
          onChange={(value) => patchSemantic({ minScore: value ?? 0 })}
          hint={errors.semanticMinScore}
        />
      </Section>

      <Section title={t("memory.settings.scope.title")} description={t("memory.settings.scope.description")}>
        <Field label={t("memory.settings.scope.mode")} htmlFor="memory-scope-mode">
          <select
            id="memory-scope-mode"
            value={draft.scope.mode}
            onChange={(event) => patchScope({ mode: event.target.value as MemoryScope["mode"] })}
            className={inputClasses}
          >
            <option value="chat">{t("memory.settings.scope.chat")}</option>
            <option value="shared">{t("memory.settings.scope.shared")}</option>
          </select>
        </Field>
        <Field
          label={t("memory.settings.scope.key")}
          htmlFor="memory-scope-key"
          hint={draft.scope.mode === "shared" && !draft.scope.key.trim()
            ? t("memory.settings.scope.keyHintEmpty")
            : t("memory.settings.scope.keyHint")}
        >
          <input
            id="memory-scope-key"
            type="text"
            value={draft.scope.key}
            placeholder={t("memory.settings.scope.keyPlaceholder")}
            onChange={(event) => patchScope({ key: event.target.value })}
            className={inputClasses}
          />
        </Field>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          disabled={!dirty || saving || save.busy || Object.keys(errors).length > 0 || !onUpdateSettings}
          onClick={() => void submit()}
        >
          {saving || save.busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {t("memory.settings.saveChanges")}
        </Button>
        {dirty && (
          <Button variant="ghost" disabled={save.busy} onClick={() => { setEdit(null); save.clearError(); }}>
            {t("memory.settings.discard")}
          </Button>
        )}
        {savedAt && !dirty && <span className="text-xs text-success">{t("memory.settings.saved", { date: formatDate(savedAt) ?? "" })}</span>}
        {!onUpdateSettings && <span className="text-xs text-text-faint">{t("memory.settings.notConnected")}</span>}
      </div>
      {save.error && <Alert kind="error">{save.error}</Alert>}

      <Section
        title={t("memory.settings.maintenance.title")}
        description={t("memory.settings.maintenance.description")}
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t("memory.settings.maintenance.extractionMode")} htmlFor="memory-extract-mode" className="min-w-48">
            <select
              id="memory-extract-mode"
              value={extractionMode}
              onChange={(event) => setExtractionMode(event.target.value as MemoryExtractionMode | "settings")}
              className={inputClasses}
            >
              <option value="settings">{t("memory.settings.maintenance.perSettings")}</option>
              {MODES.map((mode) => <option key={mode} value={mode}>{t(EXTRACTION_MODE_LABELS[mode])}</option>)}
            </select>
          </Field>
          <Button
            variant="secondary"
            disabled={extract.busy || !onRunExtraction}
            onClick={() => void runAllExtraction()}
            title={t("memory.settings.maintenance.extractAllTitle")}
          >
            {extract.busy ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
            {t("memory.settings.maintenance.extractAll")}
          </Button>
        </div>
        <p className="text-xs text-text-faint">
          {t("memory.settings.maintenance.extractAllBody")}
        </p>
        {extract.error && <Alert kind="error">{extract.error}</Alert>}
        {skipped && <Alert kind="info">{t(SKIPPED_LABELS[skipped] ?? SKIPPED_FALLBACK, { reason: skipped })}</Alert>}
        {report && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-text-muted">{t("memory.settings.maintenance.lastExtraction")}</p>
            <ExtractionSummary report={report} />
          </div>
        )}
        {!report && !skipped && (
          <p className="text-xs text-text-faint">{t("memory.settings.maintenance.noManualYet")}</p>
        )}

        <div className="mt-2 border-t border-border pt-3">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-text-muted">
            <Eye size={13} />
            {t("memory.settings.maintenance.previewTitle")}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t("memory.settings.maintenance.query")} htmlFor="memory-preview-query" className="min-w-56 flex-1">
              <input
                id="memory-preview-query"
                type="text"
                value={previewQuery}
                placeholder={t("memory.settings.maintenance.queryPlaceholder")}
                onChange={(event) => setPreviewQuery(event.target.value)}
                className={inputClasses}
              />
            </Field>
            <Field label={t("memory.settings.maintenance.responder")} htmlFor="memory-preview-responder" className="min-w-40">
              <select
                id="memory-preview-responder"
                value={previewResponder}
                onChange={(event) => setPreviewResponder(event.target.value)}
                className={inputClasses}
              >
                <option value="">{t("memory.settings.maintenance.anyone")}</option>
                {knownNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </Field>
            <Button
              variant="secondary"
              disabled={previewAction.busy || !onPreviewBrief}
              onClick={() => void runPreview()}
            >
              {previewAction.busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {t("memory.settings.maintenance.preview")}
            </Button>
          </div>
          <p className="mt-1 text-xs text-text-faint">
            {t("memory.settings.maintenance.previewNote")}
          </p>
          {previewAction.error && <div className="mt-2"><Alert kind="error">{previewAction.error}</Alert></div>}
          {preview && (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-faint">
                <span>{t("memory.shared.characters", { count: preview.brief.trim().length })}</span>
                <span>{t("memory.shared.items", { count: preview.trace.selected?.length ?? 0 })}</span>
                {preview.trace.omittedCount > 0 && <span>{t("memory.shared.omitted", { count: preview.trace.omittedCount })}</span>}
              </div>
              {preview.brief.trim() ? (
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-bg p-3 font-mono text-xs leading-relaxed text-text">
                  {preview.brief}
                </pre>
              ) : (
                <Alert kind="info">{t("memory.settings.maintenance.previewEmpty")}</Alert>
              )}
            </div>
          )}
          {!onPreviewBrief && <p className="mt-2 text-xs text-text-faint">{t("memory.settings.maintenance.previewNotConnected")}</p>}
        </div>
      </Section>
    </div>
  );
}
