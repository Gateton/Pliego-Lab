import { useMemo, useState } from "react";
import { Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { useSamplingPresets } from "../../hooks/useSamplingPresets";
import { useSettings } from "../../hooks/useSettings";
import { useProviders } from "../../hooks/useProviders";
import { useProviderModels } from "../../hooks/useProviderModels";
import type { Effort, SamplingPreset } from "../../types/samplingPreset";
import type { ProviderCapabilities } from "../../types/provider";
import { Button, Card, Field, NumberSlider, PageHeader, Tabs, Toggle, inputClasses } from "../ui";
import { ModelSelect } from "../settings/ModelSelect";
import { ProviderConnectionPanel } from "../settings/ProviderConnectionPanel";
import { useT } from "../../i18n";
import type { TranslationKey } from "../../i18n";

type NumericKey =
  | "temperature"
  | "top_p"
  | "top_k"
  | "repetition_penalty"
  | "frequency_penalty"
  | "presence_penalty"
  | "max_tokens"
  | "min_p"
  | "seed"
  | "n";

interface NumericFieldDef {
  key: NumericKey;
  labelKey: TranslationKey;
  hintKey: TranslationKey;
  min: number;
  max: number;
  step: number;
  capability?: keyof ProviderCapabilities["params"];
}

const NUMERIC_FIELDS: NumericFieldDef[] = [
  { key: "temperature", labelKey: "presets.sampling.fields.temperature.label", hintKey: "presets.sampling.fields.temperature.hint", min: 0, max: 2, step: 0.01 },
  { key: "top_p", labelKey: "presets.sampling.fields.topP.label", hintKey: "presets.sampling.fields.topP.hint", min: 0, max: 1, step: 0.01 },
  { key: "top_k", labelKey: "presets.sampling.fields.topK.label", hintKey: "presets.sampling.fields.topK.hint", min: 0, max: 200, step: 1, capability: "top_k" },
  { key: "repetition_penalty", labelKey: "presets.sampling.fields.repetitionPenalty.label", hintKey: "presets.sampling.fields.repetitionPenalty.hint", min: 0.5, max: 2, step: 0.01, capability: "repetition_penalty" },
  { key: "frequency_penalty", labelKey: "presets.sampling.fields.frequencyPenalty.label", hintKey: "presets.sampling.fields.frequencyPenalty.hint", min: -2, max: 2, step: 0.01, capability: "frequency_penalty" },
  { key: "presence_penalty", labelKey: "presets.sampling.fields.presencePenalty.label", hintKey: "presets.sampling.fields.presencePenalty.hint", min: -2, max: 2, step: 0.01, capability: "presence_penalty" },
  { key: "max_tokens", labelKey: "presets.sampling.fields.maxTokens.label", hintKey: "presets.sampling.fields.maxTokens.hint", min: 0, max: 32000, step: 1 },
  { key: "min_p", labelKey: "presets.sampling.fields.minP.label", hintKey: "presets.sampling.fields.minP.hint", min: 0, max: 1, step: 0.01, capability: "min_p" },
  { key: "seed", labelKey: "presets.sampling.fields.seed.label", hintKey: "presets.sampling.fields.seed.hint", min: 0, max: 999999, step: 1, capability: "seed" },
  { key: "n", labelKey: "presets.sampling.fields.n.label", hintKey: "presets.sampling.fields.n.hint", min: 1, max: 5, step: 1, capability: "n" },
];

const EFFORT_OPTIONS: { value: Effort; labelKey: TranslationKey }[] = [
  { value: "auto", labelKey: "presets.sampling.auto" },
  { value: "low", labelKey: "presets.sampling.effort.low" },
  { value: "medium", labelKey: "presets.sampling.effort.medium" },
  { value: "high", labelKey: "presets.sampling.effort.high" },
];

const FORM_TABS: { id: string; labelKey: TranslationKey }[] = [
  { id: "sampling", labelKey: "presets.manager.tabs.sampling" },
  { id: "reasoning", labelKey: "presets.manager.tabs.reasoning" },
  { id: "context", labelKey: "presets.manager.tabs.context" },
  { id: "connection", labelKey: "presets.manager.tabs.connection" },
];

type NumericForm = Record<NumericKey, number | undefined>;

type FormState = {
  name: string;
  model: string;
  middleOut: NonNullable<SamplingPreset["middleOut"]>;
  reasoningEnabled: boolean;
  reasoningEffort: Effort;
  verbosity: Effort;
  maxContextTokens: number | undefined;
  squashSystemMessages: boolean;
  strictAlternation: boolean;
} & NumericForm;

function emptyNumeric(): NumericForm {
  const numeric = {} as NumericForm;
  for (const { key } of NUMERIC_FIELDS) numeric[key] = undefined;
  return numeric;
}

function emptyForm(): FormState {
  return {
    name: "",
    model: "",
    middleOut: "auto",
    reasoningEnabled: false,
    reasoningEffort: "auto",
    verbosity: "auto",
    maxContextTokens: undefined,
    squashSystemMessages: false,
    strictAlternation: false,
    ...emptyNumeric(),
  };
}

function presetToForm(preset?: SamplingPreset): FormState {
  const form = emptyForm();
  if (!preset) return form;
  form.name = preset.name;
  form.model = preset.model ?? "";
  form.middleOut = preset.middleOut ?? "auto";
  form.reasoningEnabled = preset.reasoningEnabled ?? false;
  form.reasoningEffort = preset.reasoningEffort ?? "auto";
  form.verbosity = preset.verbosity ?? "auto";
  form.maxContextTokens = preset.maxContextTokens;
  form.squashSystemMessages = preset.squashSystemMessages ?? false;
  form.strictAlternation = preset.strictAlternation ?? false;
  for (const { key } of NUMERIC_FIELDS) form[key] = preset[key];
  return form;
}

function formToFields(form: FormState): Omit<SamplingPreset, "id"> {
  const numeric: Partial<NumericForm> = {};
  for (const { key } of NUMERIC_FIELDS) numeric[key] = form[key];
  return {
    name: form.name,
    ...numeric,
    model: form.model.trim() === "" ? undefined : form.model.trim(),
    middleOut: form.middleOut,
    maxContextTokens: form.maxContextTokens,
    reasoningEnabled: form.reasoningEnabled,
    reasoningEffort: form.reasoningEffort,
    verbosity: form.verbosity,
    squashSystemMessages: form.squashSystemMessages,
    strictAlternation: form.strictAlternation,
  };
}

export function SamplingPresetManager() {
  const t = useT();
  const { presets, create, update, remove } = useSamplingPresets();
  const { settings, update: updateSettings } = useSettings();
  const { active } = useProviders();
  const { models } = useProviderModels(active?.id ?? null, active?.baseUrl);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formTab, setFormTab] = useState("sampling");

  const capabilities = active?.capabilities ?? null;
  const visibleNumeric = useMemo(
    () => NUMERIC_FIELDS.filter((f) => !f.capability || capabilities?.params[f.capability] === true),
    [capabilities],
  );

  function startEdit(preset: SamplingPreset) {
    setEditingId(preset.id);
    setIsCreating(false);
    setForm(presetToForm(preset));
    setFormTab("sampling");
  }

  function startCreate() {
    setEditingId(null);
    setIsCreating(true);
    setForm(emptyForm());
    setFormTab("sampling");
  }

  function cancelForm() {
    setEditingId(null);
    setIsCreating(false);
  }

  function setNumeric(key: NumericKey, value: number | undefined) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    const fields = formToFields(form);
    if (editingId) await update(editingId, fields);
    else await create(fields);
    setEditingId(null);
    setIsCreating(false);
  }

  async function handleSetActive(id: string) {
    if (!settings) return;
    await updateSettings({ ...settings, activeSamplingPresetId: id });
  }

  const showForm = isCreating || !!editingId;

  return (
    <div>
      <PageHeader
        icon={SlidersHorizontal}
        title={t("presets.manager.title")}
        description={t("presets.manager.description")}
      />

      <Field label={t("presets.shared.activePreset")} hint={t("presets.manager.activePresetHint")} className="mb-6 max-w-sm">
        <select value={settings?.activeSamplingPresetId ?? ""} onChange={(e) => handleSetActive(e.target.value)} className={inputClasses}>
          {presets.length === 0 && <option value="">{t("presets.manager.noPresetsOption")}</option>}
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex flex-col gap-2">
        {presets.length === 0 && !showForm && <p className="text-sm text-text-muted">{t("presets.manager.empty")}</p>}
        {presets.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg-elevated px-3 py-2">
            <span className="min-w-0">
              <span className="text-sm text-text">{p.name}</span>
              <span className="ml-2 text-xs text-text-faint">{p.model || t("presets.manager.providerModelFallback")}</span>
              <span className="ml-2 text-xs text-text-faint">
                · {p.promptBlocks?.length ? t("presets.manager.promptCount", { count: p.promptBlocks.length }) : t("presets.manager.noPrompts")}
              </span>
            </span>
            <span className="flex shrink-0 gap-1">
              <button
                onClick={() => startEdit(p)}
                aria-label={t("presets.shared.editPreset")}
                title={t("presets.shared.edit")}
                className="cursor-pointer rounded p-1.5 text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-text"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => remove(p.id)}
                aria-label={t("presets.shared.deletePreset")}
                title={t("presets.shared.delete")}
                className="cursor-pointer rounded p-1.5 text-text-muted transition-colors hover:bg-danger/15 hover:text-danger"
              >
                <Trash2 size={14} />
              </button>
            </span>
          </div>
        ))}
      </div>

      {!showForm && (
        <Button variant="secondary" className="mt-4" onClick={startCreate}>
          <Plus size={16} />
          {t("presets.shared.newPreset")}
        </Button>
      )}

      {showForm && (
        <Card className="mt-4">
          <Field label={t("presets.shared.presetName")} className="mb-4 max-w-sm">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClasses} />
          </Field>

          <Tabs tabs={FORM_TABS.map((tab) => ({ id: tab.id, label: t(tab.labelKey) }))} active={formTab} onChange={setFormTab} />

          {formTab === "sampling" && (
            <div className="mt-4">
              <Field label={t("presets.shared.model")} hint={t("presets.manager.modelHint")} className="mb-4">
                <ModelSelect models={models} value={form.model} onChange={(id) => setForm((f) => ({ ...f, model: id }))} placeholder={t("presets.manager.modelPlaceholder")} />
              </Field>

              {capabilities && (
                <p className="mb-3 text-xs text-text-faint">{t("presets.manager.capabilitiesNotice", { provider: active?.label ?? "" })}</p>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {visibleNumeric.map(({ key, labelKey, hintKey, min, max, step }) => (
                  <NumberSlider
                    key={key}
                    label={t(labelKey)}
                    hint={t(hintKey)}
                    value={form[key]}
                    onChange={(v) => setNumeric(key, v)}
                    min={min}
                    max={max}
                    step={step}
                    optional
                  />
                ))}

                {capabilities?.params.transforms && (
                  <Field label={t("presets.sampling.middleOut.label")} hint={t("presets.sampling.middleOut.hint")}>
                    <select
                      value={form.middleOut}
                      onChange={(e) => setForm((f) => ({ ...f, middleOut: e.target.value as FormState["middleOut"] }))}
                      className={inputClasses}
                    >
                      <option value="auto">{t("presets.sampling.auto")}</option>
                      <option value="allow">{t("presets.sampling.middleOut.allow")}</option>
                      <option value="forbid">{t("presets.sampling.middleOut.forbid")}</option>
                    </select>
                  </Field>
                )}
              </div>
            </div>
          )}

          {formTab === "reasoning" && (
            <div className="mt-4 flex max-w-lg flex-col gap-4">
              <Toggle
                checked={form.reasoningEnabled}
                onChange={(v) => setForm((f) => ({ ...f, reasoningEnabled: v }))}
                label={t("presets.sampling.reasoning.label")}
                hint={t("presets.sampling.reasoning.hint")}
              />
              <Field label={t("presets.sampling.reasoningEffort.label")} hint={t("presets.sampling.reasoningEffort.hint")}>
                <select
                  value={form.reasoningEffort}
                  onChange={(e) => setForm((f) => ({ ...f, reasoningEffort: e.target.value as Effort }))}
                  className={inputClasses}
                >
                  {EFFORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(o.labelKey)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("presets.sampling.verbosity.label")} hint={t("presets.sampling.verbosity.hint")}>
                <select
                  value={form.verbosity}
                  onChange={(e) => setForm((f) => ({ ...f, verbosity: e.target.value as Effort }))}
                  className={inputClasses}
                >
                  {EFFORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(o.labelKey)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {formTab === "context" && (
            <div className="mt-4 flex max-w-lg flex-col gap-4">
              <NumberSlider
                label={t("presets.sampling.contextSize.label")}
                hint={t("presets.sampling.contextSize.hint")}
                value={form.maxContextTokens}
                onChange={(v) => setForm((f) => ({ ...f, maxContextTokens: v }))}
                min={1000}
                max={200000}
                step={1000}
                optional
                /* Unit symbol, not copy: "tokens" is the same word in every language. */
                suffix="tokens"
              />
              <Toggle
                checked={form.squashSystemMessages}
                onChange={(v) => setForm((f) => ({ ...f, squashSystemMessages: v }))}
                label={t("presets.sampling.squashSystemMessages.label")}
                hint={t("presets.sampling.squashSystemMessages.hint")}
              />
              <Toggle
                checked={form.strictAlternation}
                onChange={(v) => setForm((f) => ({ ...f, strictAlternation: v }))}
                label={t("presets.sampling.strictAlternation.label")}
                hint={t("presets.sampling.strictAlternation.hint")}
              />
            </div>
          )}

          {formTab === "connection" && (
            <div className="mt-4">
              <ProviderConnectionPanel embedded />
            </div>
          )}

          <div className="mt-6 flex items-center gap-2">
            <Button onClick={handleSave} disabled={!form.name.trim()}>
              {t("presets.shared.savePreset")}
            </Button>
            <Button variant="ghost" onClick={cancelForm}>
              {t("common.actions.cancel")}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
