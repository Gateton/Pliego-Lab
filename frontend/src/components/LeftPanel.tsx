import { useSamplingPresets } from "../hooks/useSamplingPresets";
import { useSettings } from "../hooks/useSettings";
import { Field, inputClasses } from "./ui";
import { useState, useRef, useEffect } from "react";
import type { ChangeEvent } from "react";
import { ChevronDown, ChevronUp, Trash2, GripVertical, Upload } from "lucide-react";
import type { PromptBlock, PromptBlockPosition, PromptBlockRole } from "../types/settings";
import type { AppSettings } from "../types/settings";
import { estimateTokens } from "../lib/contextBudget";
import { Toggle, textareaClasses } from "./ui";
import { formatNumber, t, useT } from "../i18n";
import type { TranslationKey } from "../i18n";

const POSITION_OPTIONS: { value: PromptBlockPosition; labelKey: TranslationKey }[] = [
  { value: "system", labelKey: "presets.panel.blocks.position.system" },
  { value: "top", labelKey: "presets.panel.blocks.position.top" },
  { value: "in-chat", labelKey: "presets.panel.blocks.position.inChat" },
  { value: "post-history", labelKey: "presets.panel.blocks.position.postHistory" },
];

const ROLE_OPTIONS: { value: PromptBlockRole; labelKey: TranslationKey }[] = [
  { value: "system", labelKey: "presets.panel.blocks.role.system" },
  { value: "user", labelKey: "presets.panel.blocks.role.user" },
  { value: "assistant", labelKey: "presets.panel.blocks.role.assistant" },
];

/** Name a new block starts with, per position. Resolved at creation time so it follows the locale. */
const DEFAULT_NAME_KEYS: Record<PromptBlockPosition, TranslationKey> = {
  system: "presets.panel.blocks.defaultName.system",
  top: "presets.panel.blocks.defaultName.top",
  "in-chat": "presets.panel.blocks.defaultName.inChat",
  "post-history": "presets.panel.blocks.defaultName.postHistory",
};

/**
 * Output-language choices. Each language is named in its own language and is therefore never
 * translated, exactly like LOCALE_NATIVE_NAMES in src/i18n/types.ts. Only the empty choice ("do
 * not force a language") is copy and lives in the catalog.
 */
const OUTPUT_LANGUAGES: { value: string; nativeName: string }[] = [
  { value: "español", nativeName: "Español" },
  { value: "English", nativeName: "English" },
  { value: "français", nativeName: "Français" },
  { value: "português", nativeName: "Português" },
  { value: "Deutsch", nativeName: "Deutsch" },
  { value: "italiano", nativeName: "Italiano" },
  { value: "日本語", nativeName: "日本語" },
];

function newBlock(position: PromptBlockPosition = "top"): PromptBlock {
  return {
    id: crypto.randomUUID(),
    // The name is interface copy (it shows up in the block list and stays editable), so it is
    // resolved when the block is created, in the locale that is active then.
    name: t(DEFAULT_NAME_KEYS[position]),
    role: "system",
    content: "",
    enabled: true,
    position,
    depth: position === "in-chat" ? 2 : undefined,
  };
}

interface PromptValue {
  promptBlocks: PromptBlock[];
  contextTemplate: string;
  contextTemplateEnabled: boolean;
}

interface Props {
  onOpenSampling: () => void;
}

export function LeftPanel({ onOpenSampling }: Props) {
  const t = useT();
  const { settings, update } = useSettings();
  const { presets, update: updatePreset, importFile } = useSamplingPresets();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  if (!settings) return null;
  const s = settings;

  const activePreset = presets.find((p) => p.id === s.activeSamplingPresetId) ?? null;
  const effectiveModel = activePreset?.model || t("presets.panel.defaultModelFallback");

  // The prompt list belongs to the active preset; the global list only applies while no preset is
  // active, so it is never shown here under an active preset.
  const blocks: PromptBlock[] = activePreset?.promptBlocks ?? (activePreset ? [] : (s.promptBlocks ?? []));

  const contextTemplate = activePreset?.contextTemplate || s.contextTemplate || "";
  const contextTemplateEnabled = activePreset?.contextTemplateEnabled ?? s.contextTemplateEnabled;

  async function setActivePreset(id: string | null) {
    await update({ ...s, activeSamplingPresetId: id });
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportMessage(null);
    try {
      const result = await importFile(file);
      setImportMessage({
        ok: result.errors.length === 0,
        text: result.errors.length
          ? t("presets.manager.importWithErrors", { count: result.imported.length, errors: result.errors.join(" · ") })
          : t("presets.manager.importSuccess", { count: result.imported.length }),
      });
    } catch (err) {
      setImportMessage({
        ok: false,
        text: err instanceof Error ? err.message : t("common.errors.preset.importInvalid"),
      });
    } finally {
      setImporting(false);
    }
  }

  function setOutputLanguage(lang: string) {
    void update({ ...s, outputLanguage: lang });
  }

  function persistGlobal(patch: Partial<AppSettings>) {
    void update({ ...s, ...patch });
  }

  function setContextSize(tokens: number) {
    // Context budget lives on the preset now — there is no global fallback to write to.
    if (!activePreset) return;
    void updatePreset(activePreset.id, { ...activePreset, maxContextTokens: tokens });
  }

  function scheduleSave(nextBlocks: PromptBlock[]) {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const value: PromptValue = {
        promptBlocks: nextBlocks,
        contextTemplate,
        contextTemplateEnabled,
      };
      if (activePreset) {
        void updatePreset(activePreset.id, { ...activePreset, ...value });
      } else {
        void update({ ...s, ...value });
      }
    }, 600);
  }

  function updateBlock(id: string, patch: Partial<PromptBlock>) {
    scheduleSave(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function removeBlock(id: string) {
    scheduleSave(blocks.filter((b) => b.id !== id));
  }

  function moveBlock(id: string, dir: -1 | 1) {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    scheduleSave(next);
  }

  function addBlock() {
    const b = newBlock();
    scheduleSave([...blocks, b]);
    setExpanded((prev) => new Set(prev).add(b.id));
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col" data-tour="panel-respuesta">
      <div className="shrink-0 border-b border-border px-3 py-2.5">
        <Field label={t("presets.shared.activePreset")} hint={t("presets.panel.activePresetHint", { model: effectiveModel })}>
          <select value={s.activeSamplingPresetId ?? ""} onChange={(e) => setActivePreset(e.target.value || null)} className={inputClasses}>
            <option value="">{t("presets.panel.noPresetOption")}</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <button onClick={onOpenSampling} className="mt-1.5 cursor-pointer text-xs text-accent transition-colors hover:text-accent-hover">
          {t("presets.panel.editPresets")}
        </button>
        <button
          onClick={() => importInputRef.current?.click()}
          disabled={importing}
          className="mt-1.5 ml-3 inline-flex cursor-pointer items-center gap-1 text-xs text-text-muted transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Upload size={12} />
          {importing ? t("presets.manager.importing") : t("presets.manager.importPreset")}
        </button>
        <input ref={importInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} className="hidden" />
        {importMessage && (
          <p className={`mt-1 text-[11px] ${importMessage.ok ? "text-success" : "text-warning"}`}>{importMessage.text}</p>
        )}
        <div className="mt-2.5">
          <Field label={t("presets.panel.outputLanguage.label")} hint={t("presets.panel.outputLanguage.hint")}>
            <select value={s.outputLanguage} onChange={(e) => setOutputLanguage(e.target.value)} className={inputClasses}>
              <option value="">{t("presets.panel.outputLanguage.auto")}</option>
              {OUTPUT_LANGUAGES.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.nativeName}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-2.5">
          <Field
            label={t("presets.panel.contextSize.label")}
            hint={
              activePreset
                ? t("presets.panel.contextSize.activeHint", {
                    tokens: formatNumber(activePreset.maxContextTokens ?? 8000),
                  })
                : t("presets.panel.contextSize.noPresetHint")
            }
          >
            <input
              type="range"
              min={1000}
              max={128000}
              step={1000}
              value={activePreset?.maxContextTokens ?? 8000}
              disabled={!activePreset}
              onChange={(e) => setContextSize(Number(e.target.value))}
              className="w-full accent-accent disabled:opacity-40"
            />
          </Field>
        </div>
        <div className="mt-3 grid gap-2 border-t border-border pt-3">
          <Toggle
            id="response-streaming"
            checked={s.streaming}
            onChange={(streaming) => persistGlobal({ streaming })}
            label={t("presets.panel.streaming.label")}
            hint={t("presets.panel.streaming.hint")}
          />
          <Toggle
            id="response-colored-dialogue"
            checked={s.coloredDialogue}
            onChange={(coloredDialogue) => persistGlobal({ coloredDialogue })}
            label={t("presets.panel.coloredDialogue.label")}
            hint={t("presets.panel.coloredDialogue.hint")}
          />
        </div>
      </div>

      {/* Prompt blocks */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-medium text-text-muted">
            {activePreset
              ? t("presets.panel.blocks.withPreset", { name: activePreset.name })
              : t("presets.panel.blocks.global")}
          </h4>
          <button
            onClick={addBlock}
            className="cursor-pointer rounded px-2 py-1 text-xs text-text-muted transition-colors hover:text-text hover:bg-bg-elevated-2"
          >
            {t("presets.panel.blocks.add")}
          </button>
        </div>

        {blocks.length === 0 && (
          <p className="text-xs text-text-faint">
            {activePreset ? t("presets.panel.blocks.emptyWithPreset") : t("presets.panel.blocks.emptyGlobal")}
          </p>
        )}

        {blocks.map((b) => {
          const isOpen = expanded.has(b.id);
          const positionOption = POSITION_OPTIONS.find((p) => p.value === b.position);
          return (
            <div key={b.id} className={`mb-1.5 rounded-md border ${b.enabled ? "border-border bg-bg-elevated" : "border-border/50 bg-bg-elevated/50"}`}>
              <div className="flex items-center gap-1 px-1.5 py-1.5">
                <div className="cursor-grab text-text-faint hover:text-text">
                  <GripVertical size={13} />
                </div>
                <button onClick={() => moveBlock(b.id, -1)} disabled={blocks.indexOf(b) === 0} className="cursor-pointer rounded p-1 text-text-faint hover:text-text disabled:cursor-not-allowed disabled:opacity-30">
                  <ChevronUp size={13} />
                </button>
                <button onClick={() => moveBlock(b.id, 1)} disabled={blocks.indexOf(b) === blocks.length - 1} className="cursor-pointer rounded p-1 text-text-faint hover:text-text disabled:cursor-not-allowed disabled:opacity-30">
                  <ChevronDown size={13} />
                </button>
                <Toggle checked={b.enabled} onChange={(v) => updateBlock(b.id, { enabled: v })} />
                <input
                  value={b.name}
                  onChange={(e) => updateBlock(b.id, { name: e.target.value })}
                  className={`${inputClasses} flex-1 py-1! text-xs`}
                />
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium" style={{
                  backgroundColor: b.position === "system" ? "var(--accent)" :
                                  b.position === "top" ? "#3b82f6" :
                                  b.position === "in-chat" ? "#eab308" : "#ef4444",
                  color: "white"
                }}>
                  {positionOption ? t(positionOption.labelKey) : null}
                </span>
                <span className="shrink-0 text-[10px] text-text-faint">~{estimateTokens(b.content)}</span>
                <button onClick={() => toggleExpand(b.id)} className="cursor-pointer rounded p-1 text-text-faint hover:text-text">
                  {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                <button onClick={() => removeBlock(b.id)} className="cursor-pointer rounded p-1 text-text-faint hover:text-danger">
                  <Trash2 size={13} />
                </button>
              </div>

              {isOpen && (
                <div className="flex flex-col gap-2 border-t border-border p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={b.role}
                      onChange={(e) => updateBlock(b.id, { role: e.target.value as PromptBlockRole })}
                      className={`${inputClasses} w-auto! py-1! text-xs`}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>{t(r.labelKey)}</option>
                      ))}
                    </select>
                    <select
                      value={b.position}
                      onChange={(e) => updateBlock(b.id, { position: e.target.value as PromptBlockPosition })}
                      className={`${inputClasses} w-auto! py-1! text-xs`}
                    >
                      {POSITION_OPTIONS.map((p) => (
                        <option key={p.value} value={p.value}>{t(p.labelKey)}</option>
                      ))}
                    </select>
                    {b.position === "in-chat" && (
                      <label className="flex items-center gap-1 text-xs text-text-muted">
                        {t("presets.panel.blocks.depth")}
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={b.depth ?? 0}
                          onChange={(e) => updateBlock(b.id, { depth: Math.max(0, Math.min(20, Number(e.target.value))) })}
                          className={`${inputClasses} w-14! py-1! text-xs`}
                        />
                      </label>
                    )}
                  </div>
                  <textarea
                    value={b.content}
                    onChange={(e) => updateBlock(b.id, { content: e.target.value })}
                    rows={5}
                    className={`${textareaClasses} font-mono text-xs`}
                    placeholder={t("presets.panel.blocks.contentPlaceholder")}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
