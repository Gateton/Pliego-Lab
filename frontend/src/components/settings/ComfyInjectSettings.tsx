import { useState } from "react";
import { ImageIcon, Loader2, Pencil, Trash2 } from "lucide-react";
import { useT } from "../../i18n";
import type { TranslationKey } from "../../i18n";
import * as comfyInjectApi from "../../api/comfyInject";
import { useComfyInjectSettings } from "../../hooks/useComfyInjectSettings";
import type { AspectRatioToken, ComfyInjectSettings as Settings, StylePreset, TestGenerateResult } from "../../types/comfyInject";
import { buildDefaultComfyInjectDirective } from "../../lib/comfyInjectPrompt";
import { Button, Field, PageHeader, Section, Tabs, Toggle, inputClasses, textareaClasses } from "../ui";

const AR_TOKENS: AspectRatioToken[] = ["PORTRAIT", "SQUARE", "LANDSCAPE", "CINEMA"];
const SHOT_TOKENS = [
  "CLOSE",
  "MEDIUM",
  "WIDE",
  "DUTCH",
  "OVERHEAD",
  "LOWANGLE",
  "HIGHANGLE",
  "PROFILE",
  "BACKVIEW",
  "POV",
];

/**
 * The tab ids drive the panels below; the label is copy, so the map carries the key and the
 * component resolves it with `t()` while rendering.
 */
const TABS: { id: string; labelKey: TranslationKey }[] = [
  { id: "general", labelKey: "settings.comfy.tabs.general" },
  { id: "prompts", labelKey: "settings.comfy.tabs.prompts" },
  { id: "tags", labelKey: "settings.comfy.tabs.tags" },
  { id: "locks", labelKey: "settings.comfy.tabs.locks" },
  { id: "presets", labelKey: "settings.comfy.tabs.presets" },
  { id: "test", labelKey: "settings.comfy.tabs.test" },
];

interface Props {
  /** Used when embedded in the left sidebar's quick-access tab: drops the page header to save
   * vertical space, since the surrounding tab already makes clear what this panel is. */
  compact?: boolean;
}

export function ComfyInjectSettings({ compact }: Props = {}) {
  const t = useT();
  const { settings, workflows, checkpoints, diffusionModels, textEncoders, vaes, loras, update } = useComfyInjectSettings();
  const [tab, setTab] = useState("general");
  const [presetName, setPresetName] = useState("");
  const [testPrompt, setTestPrompt] = useState("");
  const [testAr, setTestAr] = useState<AspectRatioToken>("SQUARE");
  const [testShot, setTestShot] = useState("MEDIUM");
  const [testSeed, setTestSeed] = useState("");
  const [testWidth, setTestWidth] = useState("");
  const [testHeight, setTestHeight] = useState("");
  const [testGenerating, setTestGenerating] = useState(false);
  const [testResult, setTestResult] = useState<TestGenerateResult | null>(null);
  const [testError, setTestError] = useState("");

  if (!settings) return <p className="text-text-muted">{t("common.state.loading")}</p>;
  const form = settings;

  // Auto-saves immediately (no "Guardar" button), same pattern as RecastSettings.tsx.
  function persist(next: Settings) {
    void update(next);
  }

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    persist({ ...form, [key]: value });
  }

  function setResolution(ar: AspectRatioToken, field: "width" | "height", value: number) {
    persist({ ...form, resolutions: { ...form.resolutions, [ar]: { ...form.resolutions[ar], [field]: value } } });
  }

  function setShotTag(shot: string, value: string) {
    persist({ ...form, shot_tags: { ...form.shot_tags, [shot]: value } });
  }

  function setLora(index: number, field: "name" | "strength_model" | "strength_clip", value: string | number) {
    const nextLoras = form.loras.map((l, i) => (i === index ? { ...l, [field]: value } : l));
    persist({ ...form, loras: nextLoras });
  }

  function addLoraRow() {
    persist({ ...form, loras: [...form.loras, { name: "", strength_model: 1, strength_clip: 1 }] });
  }

  function removeLoraRow(index: number) {
    persist({ ...form, loras: form.loras.filter((_, i) => i !== index) });
  }

  function saveCurrentAsPreset() {
    const name = presetName.trim();
    if (!name) return;
    const snapshot: StylePreset = {
      id: crypto.randomUUID(),
      name,
      checkpoint: form.checkpoint,
      negative_prompt: form.negative_prompt,
      prepend_prompt: form.prepend_prompt,
      append_prompt: form.append_prompt,
      steps: form.steps,
      cfg: form.cfg,
      sampler: form.sampler,
      scheduler: form.scheduler,
      denoise: form.denoise,
      loras: form.loras.map((l) => ({ ...l })),
    };
    const existing = form.presets.find((p) => p.name === name);
    persist({
      ...form,
      presets: existing
        ? form.presets.map((p) => (p.name === name ? { ...snapshot, id: existing.id } : p))
        : [...form.presets, snapshot],
    });
    setPresetName("");
  }

  function deletePreset(id: string) {
    persist({
      ...form,
      presets: form.presets.filter((p) => p.id !== id),
      activePresetId: form.activePresetId === id ? null : form.activePresetId,
    });
  }

  // Copies a preset's values into the visible base-tab fields so what's on screen always matches
  // what generation actually uses — previously the preset only applied silently on the backend at
  // generation time, while these fields kept showing whatever was there before, which is exactly
  // what made a preset override invisible/confusing.
  function loadPreset(preset: StylePreset) {
    persist({
      ...form,
      activePresetId: preset.id,
      checkpoint: preset.checkpoint,
      negative_prompt: preset.negative_prompt,
      prepend_prompt: preset.prepend_prompt,
      append_prompt: preset.append_prompt,
      steps: preset.steps,
      cfg: preset.cfg,
      sampler: preset.sampler,
      scheduler: preset.scheduler,
      denoise: preset.denoise,
      loras: preset.loras.map((l) => ({ ...l })),
    });
  }

  // "Editar": loads the preset into the base tabs (same as selecting it) AND pre-fills the save
  // name, so adjusting fields and clicking "Guardar" overwrites this exact preset (by name match,
  // same as the existing save behavior) instead of creating a new one.
  function editPreset(preset: StylePreset) {
    loadPreset(preset);
    setPresetName(preset.name);
  }

  async function runTestGenerate() {
    if (!testPrompt.trim()) return;
    setTestGenerating(true);
    setTestError("");
    setTestResult(null);
    try {
      const seed = testSeed.trim() ? Number(testSeed) : undefined;
      const w = Number(testWidth);
      const h = Number(testHeight);
      const resolution = w > 0 && h > 0 ? { width: w, height: h } : undefined;
      const result = await comfyInjectApi.testGenerate(testPrompt.trim(), testAr, testShot, seed, resolution);
      setTestResult(result);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : t("settings.comfy.test.error"));
    } finally {
      setTestGenerating(false);
    }
  }

  return (
    <div>
      {!compact && (
        <PageHeader
          icon={ImageIcon}
          title={t("settings.comfy.title")}
          description={t("settings.comfy.description")}
        />
      )}

      <div className="mb-5">
        <Toggle
          id="comfy-enabled"
          checked={form.enabled}
          onChange={(enabled) => set("enabled", enabled)}
          label={t("settings.shared.enabled")}
          hint={t("settings.comfy.enabledHint")}
        />
      </div>

      <Tabs tabs={TABS.map((tabItem) => ({ id: tabItem.id, label: t(tabItem.labelKey) }))} active={tab} onChange={setTab} />

      <div className="mt-5 flex flex-col gap-4">
        {tab === "general" && (
          <>
            <Field label={t("settings.comfy.general.host")} hint={t("settings.comfy.general.hostHint")}>
              <input value={form.comfy_host} onChange={(e) => set("comfy_host", e.target.value)} className={inputClasses} />
            </Field>

            <Field label={t("settings.comfy.general.checkpoint")} hint={t("settings.comfy.general.checkpointHint")}>
              <input
                value={form.checkpoint}
                onChange={(e) => set("checkpoint", e.target.value)}
                list="comfy-checkpoints"
                className={inputClasses}
              />
              <datalist id="comfy-checkpoints">
                {checkpoints.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>

            <Field label={t("settings.comfy.general.workflow")}>
              <select value={form.workflow} onChange={(e) => set("workflow", e.target.value)} className={inputClasses}>
                {workflows.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </Field>

            {form.workflow.toLowerCase().includes("krea2") && (
              <>
                <Field
                  label={t("settings.comfy.general.diffusionModel")}
                  hint={t("settings.comfy.general.diffusionModelHint")}
                >
                  <input
                    value={form.diffusion_model}
                    onChange={(e) => set("diffusion_model", e.target.value)}
                    list="comfy-diffusion-models"
                    className={inputClasses}
                  />
                  <datalist id="comfy-diffusion-models">
                    {diffusionModels.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </Field>

                <Field
                  label={t("settings.comfy.general.textEncoder")}
                  hint={t("settings.comfy.general.textEncoderHint")}
                >
                  <input
                    value={form.text_encoder}
                    onChange={(e) => set("text_encoder", e.target.value)}
                    list="comfy-text-encoders"
                    className={inputClasses}
                  />
                  <datalist id="comfy-text-encoders">
                    {textEncoders.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </Field>

                <Field label={t("settings.comfy.general.vae")} hint={t("settings.comfy.general.vaeHint")}>
                  <input
                    value={form.vae}
                    onChange={(e) => set("vae", e.target.value)}
                    list="comfy-vaes"
                    className={inputClasses}
                  />
                  <datalist id="comfy-vaes">
                    {vaes.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </Field>
              </>
            )}

            <Field label={t("settings.comfy.general.maxPollAttempts")} hint={t("settings.comfy.general.maxPollAttemptsHint")}>
              <input
                type="number"
                value={form.max_poll_attempts}
                onChange={(e) => set("max_poll_attempts", Number(e.target.value))}
                className={inputClasses}
              />
            </Field>
          </>
        )}

        {tab === "prompts" && (
          <>
            <Section title={t("settings.comfy.prompts.baseTitle")} description={t("settings.comfy.prompts.baseDescription")}>
            <Field
              label={t("settings.comfy.prompts.directive")}
              hint={t("settings.comfy.prompts.directiveHint")}
            >
              <Toggle
                checked={form.customDirectiveEnabled}
                onChange={(v) => set("customDirectiveEnabled", v)}
                label={t("settings.comfy.prompts.useCustomDirective")}
                className="mb-2"
              />
              {form.customDirectiveEnabled ? (
                <textarea
                  value={form.customDirective}
                  onChange={(e) => set("customDirective", e.target.value)}
                  rows={8}
                  className={textareaClasses}
                  placeholder={t("settings.comfy.prompts.customDirectivePlaceholder")}
                />
              ) : (
                <textarea
                  // The default image directive, which travels to ComfyUI: prompt content, not
                  // interface copy, so the coverage audit knows to leave it alone.
                  data-prompt-content
                  value={buildDefaultComfyInjectDirective(form)}
                  rows={8}
                  readOnly
                  className={`${textareaClasses} opacity-70`}
                />
              )}
            </Field>

            <Field label={t("settings.comfy.prompts.enhancer")} hint={t("settings.comfy.prompts.enhancerHint")}>
              <Toggle
                checked={form.enhancerEnabled}
                onChange={(v) => set("enhancerEnabled", v)}
                label={t("settings.comfy.prompts.enhancePrompts")}
              />
            </Field>

            <Field label={t("settings.comfy.prompts.directorMode")} hint={t("settings.comfy.prompts.directorModeHint")}>
              <Toggle
                checked={form.directorMode}
                onChange={(v) => set("directorMode", v)}
                label={t("settings.comfy.prompts.directorToggle")}
              />
            </Field>

            <Field label={t("settings.comfy.prompts.negativePrompt")} hint={t("settings.comfy.prompts.negativePromptHint")}>
              <textarea
                value={form.negative_prompt}
                onChange={(e) => set("negative_prompt", e.target.value)}
                rows={2}
                className={textareaClasses}
              />
            </Field>
            <Field label={t("settings.comfy.prompts.prependPrompt")} hint={t("settings.comfy.prompts.prependPromptHint")}>
              <input value={form.prepend_prompt} onChange={(e) => set("prepend_prompt", e.target.value)} className={inputClasses} />
            </Field>
            <Field label={t("settings.comfy.prompts.appendPrompt")} hint={t("settings.comfy.prompts.appendPromptHint")}>
              <input value={form.append_prompt} onChange={(e) => set("append_prompt", e.target.value)} className={inputClasses} />
            </Field>
            </Section>

            <Section title={t("settings.comfy.sampler.title")} description={t("settings.comfy.sampler.description")}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label={t("settings.comfy.sampler.steps")}>
                <input type="number" value={form.steps} onChange={(e) => set("steps", Number(e.target.value))} className={inputClasses} />
              </Field>
              <Field label={t("settings.comfy.sampler.cfg")}>
                <input type="number" step="any" value={form.cfg} onChange={(e) => set("cfg", Number(e.target.value))} className={inputClasses} />
              </Field>
              <Field label={t("settings.comfy.sampler.denoise")}>
                <input
                  type="number"
                  step="any"
                  value={form.denoise}
                  onChange={(e) => set("denoise", Number(e.target.value))}
                  className={inputClasses}
                />
              </Field>
              <Field label={t("settings.comfy.sampler.title")}>
                <input value={form.sampler} onChange={(e) => set("sampler", e.target.value)} className={inputClasses} />
              </Field>
              <Field label={t("settings.comfy.sampler.scheduler")}>
                <input value={form.scheduler} onChange={(e) => set("scheduler", e.target.value)} className={inputClasses} />
              </Field>
            </div>
            </Section>

            <Section title={t("settings.comfy.resolutions.title")} description={t("settings.comfy.resolutions.description")}>
            <Field label={t("settings.comfy.resolutions.label")}>
              <div className="flex flex-col gap-2">
                {AR_TOKENS.map((ar) => (
                  <div key={ar} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-sm text-text-muted">{ar}</span>
                    <input
                      type="number"
                      value={form.resolutions[ar].width}
                      onChange={(e) => setResolution(ar, "width", Number(e.target.value))}
                      className={`${inputClasses} w-24!`}
                    />
                    <span className="text-text-faint">×</span>
                    <input
                      type="number"
                      value={form.resolutions[ar].height}
                      onChange={(e) => setResolution(ar, "height", Number(e.target.value))}
                      className={`${inputClasses} w-24!`}
                    />
                  </div>
                ))}
              </div>
            </Field>
            </Section>
          </>
        )}

        {tab === "tags" && (
          <>
            <Field
              label={t("settings.comfy.tags.shotTags")}
              hint={t("settings.comfy.tags.shotTagsHint")}
            >
              <div className="flex flex-col gap-2">
                {SHOT_TOKENS.map((shot) => (
                  <div key={shot} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 text-sm text-text-muted">{shot}</span>
                    <input
                      value={form.shot_tags[shot] ?? ""}
                      onChange={(e) => setShotTag(shot, e.target.value)}
                      className={`${inputClasses} flex-1`}
                    />
                  </div>
                ))}
              </div>
            </Field>

            <Field
              label={t("settings.comfy.tags.loras")}
              hint={t("settings.comfy.tags.lorasHint")}
              className="mt-2"
            >
              <datalist id="comfy-loras">
                {loras.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
              <div className="flex flex-col gap-2">
                {form.loras.map((lora, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
                    <input
                      placeholder={t("settings.comfy.tags.name")}
                      value={lora.name}
                      onChange={(e) => setLora(i, "name", e.target.value)}
                      list="comfy-loras"
                      className={inputClasses}
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder={t("settings.comfy.tags.strengthModel")}
                      value={lora.strength_model}
                      onChange={(e) => setLora(i, "strength_model", Number(e.target.value))}
                      className={`${inputClasses} w-32!`}
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder={t("settings.comfy.tags.strengthClip")}
                      value={lora.strength_clip}
                      onChange={(e) => setLora(i, "strength_clip", Number(e.target.value))}
                      className={`${inputClasses} w-32!`}
                    />
                    <button
                      onClick={() => removeLoraRow(i)}
                      title={t("settings.comfy.tags.removeRow")}
                      aria-label={t("settings.comfy.tags.removeLora")}
                      className="shrink-0 cursor-pointer rounded p-1.5 text-text-faint transition-colors hover:bg-danger/15 hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {form.loras.length === 0 && <p className="text-sm text-text-faint">{t("settings.comfy.tags.empty")}</p>}
                <Button variant="secondary" size="sm" onClick={addLoraRow} className="mt-1 self-start">
                  {t("settings.comfy.tags.add")}
                </Button>
              </div>
            </Field>
          </>
        )}

        {tab === "locks" && (
          <>
            <p className="text-sm text-text-muted">
              {t("settings.comfy.locks.intro")}
            </p>

            <div>
              <Toggle
                checked={form.resolution_lock_enabled}
                onChange={(v) => set("resolution_lock_enabled", v)}
                label={t("settings.comfy.locks.resolution")}
              />
              {form.resolution_lock_enabled && (
                <div className="mt-2 flex items-center gap-2 pl-7">
                  <input
                    type="number"
                    value={form.resolution_lock.width}
                    onChange={(e) => set("resolution_lock", { ...form.resolution_lock, width: Number(e.target.value) })}
                    className={`${inputClasses} w-24!`}
                  />
                  <span className="text-text-faint">×</span>
                  <input
                    type="number"
                    value={form.resolution_lock.height}
                    onChange={(e) => set("resolution_lock", { ...form.resolution_lock, height: Number(e.target.value) })}
                    className={`${inputClasses} w-24!`}
                  />
                </div>
              )}
            </div>

            <div>
              <Toggle checked={form.shot_lock_enabled} onChange={(v) => set("shot_lock_enabled", v)} label={t("settings.comfy.locks.shot")} />
              {form.shot_lock_enabled && (
                <div className="mt-2 pl-7">
                  <select value={form.shot_lock} onChange={(e) => set("shot_lock", e.target.value)} className={`${inputClasses} w-48!`}>
                    {SHOT_TOKENS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <Toggle checked={form.seed_lock_enabled} onChange={(v) => set("seed_lock_enabled", v)} label={t("settings.comfy.locks.seed")} />
              {form.seed_lock_enabled && (
                <div className="mt-2 flex items-center gap-2 pl-7">
                  <select
                    value={form.seed_lock_mode}
                    onChange={(e) => set("seed_lock_mode", e.target.value as Settings["seed_lock_mode"])}
                    className={`${inputClasses} w-40!`}
                  >
                    <option value="RANDOM">{t("settings.comfy.locks.seedMode.random")}</option>
                    <option value="LOCK">{t("settings.comfy.locks.seedMode.lock")}</option>
                    <option value="CUSTOM">{t("settings.comfy.locks.seedMode.custom")}</option>
                  </select>
                  {form.seed_lock_mode === "CUSTOM" && (
                    <input
                      type="number"
                      value={form.seed_lock_value}
                      onChange={(e) => set("seed_lock_value", Number(e.target.value))}
                      className={`${inputClasses} w-32!`}
                    />
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "presets" && (
          <>
            <Field
              label={t("settings.comfy.presets.active")}
              hint={t("settings.comfy.presets.activeHint")}
            >
              <select
                value={form.activePresetId ?? ""}
                onChange={(e) => {
                  const preset = form.presets.find((p) => p.id === e.target.value);
                  if (preset) loadPreset(preset);
                  else set("activePresetId", null);
                }}
                className={inputClasses}
              >
                <option value="">{t("settings.comfy.presets.none")}</option>
                {form.presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label={t("settings.comfy.presets.saveTitle")}
              hint={t("settings.comfy.presets.saveHint")}
            >
              <div className="flex gap-2">
                <input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder={t("settings.comfy.presets.namePlaceholder")} className={inputClasses} />
                <Button variant="secondary" onClick={saveCurrentAsPreset} className="shrink-0">
                  {t("common.actions.save")}
                </Button>
              </div>
            </Field>

            {form.presets.length === 0 && <p className="text-sm text-text-faint">{t("settings.comfy.presets.empty")}</p>}
            {form.presets.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-md border border-border bg-bg-elevated px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate text-sm text-text">{p.name}</span>
                <span className="max-w-[40%] truncate text-xs text-text-faint">{p.checkpoint || "—"}</span>
                <button
                  onClick={() => editPreset(p)}
                  title={t("settings.comfy.presets.editTitle")}
                  aria-label={t("settings.comfy.presets.editStyle")}
                  className="shrink-0 cursor-pointer rounded p-1 text-text-faint transition-colors hover:text-text"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => deletePreset(p.id)}
                  title={t("settings.comfy.presets.deleteStyle")}
                  aria-label={t("settings.comfy.presets.deleteStyle")}
                  className="shrink-0 cursor-pointer rounded p-1 text-text-faint transition-colors hover:text-danger"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </>
        )}

        {tab === "test" && (
          <>
            <p className="text-sm text-text-faint">
              {t("settings.comfy.test.intro")}
            </p>

            <Field label={t("settings.comfy.test.prompt")}>
              <textarea
                rows={3}
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                placeholder={t("settings.comfy.test.promptPlaceholder")}
                className={textareaClasses}
              />
            </Field>

            <div className="flex flex-wrap gap-3">
              <Field label={t("settings.comfy.test.ar")} className="w-40">
                <select value={testAr} onChange={(e) => setTestAr(e.target.value as AspectRatioToken)} className={inputClasses}>
                  {AR_TOKENS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("settings.comfy.test.shot")} className="w-40">
                <select value={testShot} onChange={(e) => setTestShot(e.target.value)} className={inputClasses}>
                  {SHOT_TOKENS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("settings.comfy.test.seed")} className="w-40">
                <input value={testSeed} onChange={(e) => setTestSeed(e.target.value)} placeholder={t("settings.comfy.test.seedPlaceholder")} className={inputClasses} />
              </Field>
            </div>

            <Field
              label={t("settings.comfy.test.customResolution")}
              hint={t("settings.comfy.test.customResolutionHint")}
            >
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={64}
                  value={testWidth}
                  onChange={(e) => setTestWidth(e.target.value)}
                  placeholder={t("settings.comfy.test.width")}
                  className={`${inputClasses} w-28`}
                />
                <span className="text-text-faint">×</span>
                <input
                  type="number"
                  min={64}
                  value={testHeight}
                  onChange={(e) => setTestHeight(e.target.value)}
                  placeholder={t("settings.comfy.test.height")}
                  className={`${inputClasses} w-28`}
                />
                {(testWidth || testHeight) && (
                  <button
                    onClick={() => {
                      setTestWidth("");
                      setTestHeight("");
                    }}
                    className="cursor-pointer text-xs text-text-faint underline transition-colors hover:text-text"
                  >
                    {t("settings.comfy.test.clear")}
                  </button>
                )}
              </div>
            </Field>

            <Button variant="primary" onClick={runTestGenerate} disabled={testGenerating || !testPrompt.trim()} className="self-start">
              {testGenerating ? <Loader2 size={15} className="animate-spin" /> : null}
              {testGenerating ? t("settings.comfy.test.generating") : t("settings.comfy.test.generate")}
            </Button>

            {testError && <p className="text-sm text-danger">{testError}</p>}

            {testResult && (
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-elevated p-3 sm:flex-row">
                <img
                  src={testResult.imageUrl}
                  alt={t("settings.comfy.test.resultAlt")}
                  className="w-full max-w-xs shrink-0 rounded-md border border-border object-contain"
                />
                <div className="min-w-0 flex-1 text-xs text-text-muted">
                  <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">{t("settings.comfy.test.usedTitle")}</p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                    <dt className="text-text-faint">{t("settings.comfy.test.activePreset")}</dt>
                    <dd>{testResult.activePresetName ?? t("settings.comfy.presets.none")}</dd>
                    <dt className="text-text-faint">{t("settings.comfy.test.checkpoint")}</dt>
                    <dd className="truncate">{testResult.effectiveCheckpoint || "—"}</dd>
                    <dt className="text-text-faint">{t("settings.comfy.test.samplerScheduler")}</dt>
                    <dd>
                      {testResult.effectiveSampler} / {testResult.effectiveScheduler}
                    </dd>
                    <dt className="text-text-faint">{t("settings.comfy.test.loras")}</dt>
                    <dd>{testResult.effectiveLoras.filter((l) => l.name).map((l) => l.name).join(", ") || "—"}</dd>
                    <dt className="text-text-faint">{t("settings.comfy.test.seedLabel")}</dt>
                    <dd>{testResult.seed}</dd>
                    <dt className="text-text-faint">{t("settings.comfy.test.arShot")}</dt>
                    <dd>
                      {testResult.effectiveAr} / {testResult.effectiveShot}
                    </dd>
                    <dt className="text-text-faint">{t("settings.comfy.test.resolution")}</dt>
                    <dd>
                      {testResult.effectiveWidth} × {testResult.effectiveHeight}
                    </dd>
                  </dl>
                  <p className="mt-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">{t("settings.comfy.test.finalPrompt")}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-text">{testResult.positivePrompt}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
