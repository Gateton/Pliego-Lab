import { useEffect, useState } from "react";
import { Film, Play, Loader2, ChevronDown, Search } from "lucide-react";
import { useImageDirector } from "../../../hooks/useImageDirector";
import type { ImageDirectorSettings } from "../../../types/imageDirector";
import { DEFAULT_DIRECTOR_SYSTEM_PROMPT } from "../../../types/imageDirector";
import { Button, Card, Field, NumberSlider, Toggle, inputClasses, textareaClasses } from "../../ui";
import { useT } from "../../../i18n";

export function DirectorModuleContent() {
  const t = useT();
  const { settings, update, models, modelsLoading, loadModels, run } = useImageDirector();
  const [form, setForm] = useState<ImageDirectorSettings | null>(null);
  const [status, setStatus] = useState("");
  const [testText, setTestText] = useState("");
  const [testResult, setTestResult] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  useEffect(() => {
    if (models.length === 0 && !modelsLoading) loadModels();
  }, [models.length, modelsLoading, loadModels]);

  if (!form) return <p className="text-xs text-text-muted">{t("common.state.loading")}</p>;

  function set<K extends keyof ImageDirectorSettings>(key: K, value: ImageDirectorSettings[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSave() {
    if (form) {
      await update(form);
      setStatus(t("roleplay.saved"));
      setTimeout(() => setStatus(""), 2000);
    }
  }

  async function handleRun() {
    if (!testText.trim()) return;
    setIsRunning(true);
    setTestResult("");
    try {
      const { taggedText } = await run(testText);
      setTestResult(taggedText);
    } catch (err) {
      setTestResult(t("roleplay.director.runError", { message: (err as Error).message }));
    } finally {
      setIsRunning(false);
    }
  }

  const filteredModels = models.filter(
    (m) =>
      !modelSearch.trim() ||
      m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.name.toLowerCase().includes(modelSearch.toLowerCase())
  );

  const selectedModelName = models.find((m) => m.id === form.model)?.name || form.model || t("roleplay.director.selectModel");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Film size={16} className="text-accent-2" />
        <h3 className="text-sm font-semibold text-text">{t("chrome.modal.director")}</h3>
        <span className="rounded bg-accent-2/20 px-1.5 py-0.5 text-[10px] font-medium text-accent-2">{t("roleplay.director.experimental")}</span>
      </div>
      <p className="text-xs text-text-muted">
        {t("roleplay.director.description")}
      </p>

      {/* Toggle */}
      <Toggle checked={form.enabled} onChange={(v) => set("enabled", v)} label={t("roleplay.toggle.enabled")} />

      {form.enabled && (
        <>
          <NumberSlider
            label={t("roleplay.director.minTags.label")}
            hint={
              form.minTagsPerImage > 0
                ? t("roleplay.director.minTags.hintWithMin", { count: form.minTagsPerImage })
                : t("roleplay.director.minTags.hintNone")
            }
            value={form.minTagsPerImage}
            onChange={(v) => set("minTagsPerImage", v ?? 0)}
            min={0}
            max={40}
            step={1}
            className="max-w-md"
          />

          {/* Model selector */}
          <Field label={t("roleplay.director.model.label")} hint={t("roleplay.director.model.hint")}>
            <div className="relative">
              <button
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className={`${inputClasses} flex w-full items-center justify-between cursor-pointer`}
              >
                <span className={!form.model ? "text-text-faint" : ""}>{selectedModelName}</span>
                <ChevronDown size={14} />
              </button>

              {showModelDropdown && (
                <div className="absolute left-0 top-full z-20 mt-1 max-h-60 w-full overflow-hidden rounded-lg border border-border bg-bg-elevated shadow-lg">
                  <div className="border-b border-border p-2">
                    <div className="relative">
                      <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-faint" />
                      <input
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        placeholder={t("roleplay.director.searchModel")}
                        className={`${inputClasses} pl-7 text-xs`}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {modelsLoading ? (
                      <div className="flex items-center gap-2 p-3 text-xs text-text-muted">
                        <Loader2 size={12} className="animate-spin" />
                        {t("roleplay.director.loadingModels")}
                      </div>
                    ) : filteredModels.length === 0 ? (
                      <p className="p-3 text-xs text-text-faint">{t("roleplay.director.noResults")}</p>
                    ) : (
                      filteredModels.slice(0, 100).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            set("model", m.id);
                            setShowModelDropdown(false);
                            setModelSearch("");
                          }}
                          className={`flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-bg-hover ${
                            form.model === m.id ? "bg-accent/10 text-accent" : "text-text-muted"
                          }`}
                        >
                          <span className="truncate">{m.name}</span>
                          <span className="ml-auto shrink-0 font-mono text-[10px] text-text-faint">{m.id}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </Field>

          {/* Max images */}
          <Field label={t("roleplay.director.maxImages.label")} hint={t("roleplay.director.maxImages.hint", { count: form.maxImagesPerTurn })}>
            <input
              type="range"
              min={1}
              max={10}
              value={form.maxImagesPerTurn}
              onChange={(e) => set("maxImagesPerTurn", Number(e.target.value))}
              className="w-full accent-accent-2"
            />
            <div className="mt-1 flex justify-between text-[10px] text-text-faint">
              <span>1</span>
              <span className="font-medium text-text">{form.maxImagesPerTurn}</span>
              <span>10</span>
            </div>
          </Field>

          {/* Trigger mode */}
          <Field label={t("roleplay.director.triggerMode.label")} hint={t("roleplay.director.triggerMode.hint")}>
            <select
              value={form.triggerMode}
              onChange={(e) => set("triggerMode", e.target.value as ImageDirectorSettings["triggerMode"])}
              className={inputClasses}
            >
              <option value="manual">{t("roleplay.director.triggerMode.manual")}</option>
              <option value="auto">{t("roleplay.director.triggerMode.auto")}</option>
            </select>
          </Field>

          {/* Generation (sampling) */}
          <div className="rounded-md border border-border bg-bg-elevated p-3">
            <h4 className="mb-2 text-xs font-semibold text-text">{t("roleplay.director.generation.title")}</h4>
            <p className="mb-3 text-[11px] text-text-faint">
              {t("roleplay.director.generation.description")}
            </p>
            <div className="flex flex-col gap-3">
              <Field label={t("roleplay.director.temperature.label")} hint={t("roleplay.director.temperature.hint")}>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={form.temperature}
                  onChange={(e) => set("temperature", Number(e.target.value))}
                  className="w-full accent-accent-2"
                />
                <div className="mt-1 flex justify-between text-[10px] text-text-faint">
                  <span>0</span>
                  <span className="font-medium text-text">{form.temperature}</span>
                  <span>2</span>
                </div>
              </Field>
              <Field label={t("roleplay.director.topP.label")} hint={t("roleplay.director.topP.hint")}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={form.top_p}
                  onChange={(e) => set("top_p", Number(e.target.value))}
                  className="w-full accent-accent-2"
                />
                <div className="mt-1 flex justify-between text-[10px] text-text-faint">
                  <span>0</span>
                  <span className="font-medium text-text">{form.top_p}</span>
                  <span>1</span>
                </div>
              </Field>
              <NumberSlider
                label={t("roleplay.director.maxTokens.label")}
                hint={t("roleplay.director.maxTokens.hint")}
                value={form.max_tokens}
                onChange={(v) => set("max_tokens", v ?? 2000)}
                min={256}
                max={16000}
                step={256}
                suffix="tokens"
              />
              <Field label={t("roleplay.director.thinkingEffort.label")} hint={t("roleplay.director.thinkingEffort.hint")}>
                <select
                  value={form.thinkingEffort}
                  onChange={(e) => set("thinkingEffort", e.target.value as ImageDirectorSettings["thinkingEffort"])}
                  className={inputClasses}
                >
                  <option value="off">{t("roleplay.director.thinkingEffort.off")}</option>
                  <option value="auto">{t("roleplay.director.thinkingEffort.auto")}</option>
                  <option value="low">{t("roleplay.director.thinkingEffort.low")}</option>
                  <option value="medium">{t("roleplay.director.thinkingEffort.medium")}</option>
                  <option value="high">{t("roleplay.director.thinkingEffort.high")}</option>
                </select>
              </Field>
              <NumberSlider
                label={t("roleplay.director.timeout.label")}
                hint={t("roleplay.director.timeout.hint")}
                value={form.directorTimeoutSeconds}
                onChange={(v) => set("directorTimeoutSeconds", v ?? 240)}
                min={30}
                max={600}
                step={10}
                suffix="s"
              />
            </div>
          </div>

          {/* Context toggles */}
          <div className="rounded-md border border-border bg-bg-elevated p-3">
            <h4 className="mb-2 text-xs font-semibold text-text">{t("roleplay.director.context.title")}</h4>
            <p className="mb-3 text-[11px] text-text-faint">
              {t("roleplay.director.context.description")}
            </p>
            <div className="flex flex-col gap-3">
              <Toggle
                checked={form.includeCharacterContext}
                onChange={(v) => set("includeCharacterContext", v)}
                label={t("roleplay.director.context.includeCharacter")}
                hint={t("roleplay.director.context.includeCharacterHint")}
              />
              <Toggle
                checked={form.includePersonaContext}
                onChange={(v) => set("includePersonaContext", v)}
                label={t("roleplay.director.context.includePersona")}
                hint={t("roleplay.director.context.includePersonaHint")}
              />
              <Field label={t("roleplay.director.context.depth")} hint={t("roleplay.director.context.depthHint", { count: form.contextDepth })}>
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={form.contextDepth}
                  onChange={(e) => set("contextDepth", Number(e.target.value))}
                  className="w-full accent-accent-2"
                />
                <div className="mt-1 flex justify-between text-[10px] text-text-faint">
                  <span>0</span>
                  <span className="font-medium text-text">{form.contextDepth}</span>
                  <span>20</span>
                </div>
              </Field>
            </div>
          </div>

          {/* Instructions */}
          <Field label={t("roleplay.director.instructions.label")} hint={t("roleplay.director.instructions.hint")}>
            <textarea
              value={form.instructionPrompt}
              onChange={(e) => set("instructionPrompt", e.target.value)}
              rows={6}
              className={textareaClasses}
              // Prompt content, not interface copy: it is the text the model receives, and the
              // placeholder shows what the default looks like.
              data-prompt-content
              placeholder={DEFAULT_DIRECTOR_SYSTEM_PROMPT.split("\n").slice(0, 3).join("\n") + "\n…"}
            />
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 self-start"
              onClick={() => set("instructionPrompt", "")}
            >
              {t("roleplay.director.clear")}
            </Button>
          </Field>

          <div className="rounded-md border border-border bg-bg-elevated p-3">
            <Toggle
              checked={form.jailbreakEnabled}
              onChange={(v) => set("jailbreakEnabled", v)}
              label={t("roleplay.director.jailbreak.label")}
              hint={t("roleplay.director.jailbreak.hint")}
            />
            {form.jailbreakEnabled && (
              <Field
                label={t("roleplay.director.jailbreak.promptLabel")}
                hint={t("roleplay.director.jailbreak.promptHint")}
                className="mt-3"
              >
                <textarea
                  value={form.jailbreakPrompt}
                  onChange={(e) => set("jailbreakPrompt", e.target.value)}
                  rows={6}
                  className={textareaClasses}
                  placeholder={t("roleplay.director.jailbreak.placeholder")}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 self-start"
                  onClick={() => set("jailbreakPrompt", "")}
                >
                  {t("roleplay.director.clear")}
                </Button>
              </Field>
            )}
          </div>

          {/* Save */}
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={handleSave}>{t("common.actions.save")}</Button>
            {status && <span className="text-xs text-text-muted">{status}</span>}
          </div>

          {/* Test area */}
          <Card>
            <h4 className="mb-2 text-xs font-semibold text-text">{t("roleplay.director.test.title")}</h4>
            <p className="mb-2 text-[11px] text-text-faint">
              {t("roleplay.director.test.hint")}
            </p>
            <textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              rows={4}
              className={textareaClasses}
              placeholder={t("roleplay.director.test.placeholder")}
            />
            <div className="mt-2 flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleRun} disabled={isRunning || !testText.trim()}>
                {isRunning ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    {t("roleplay.director.test.running")}
                  </>
                ) : (
                  <>
                    <Play size={12} />
                    {t("roleplay.director.test.run")}
                  </>
                )}
              </Button>
            </div>
            {testResult && (
              <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-bg-elevated-2 p-3 text-xs text-text-muted">
                {testResult}
              </pre>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
