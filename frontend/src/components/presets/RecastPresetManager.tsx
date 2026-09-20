import { useState } from "react";
import { ChevronDown, ChevronUp, ListOrdered, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRecastPresets } from "../../hooks/useRecastPresets";
import { useActiveProviderModels } from "../../hooks/useProviderModels";
import type { ModelDescriptor } from "../../types/provider";
import type { RecastPass, RecastPreset } from "../../types/recast";
import { Button, Card, Field, PageHeader, Toggle, inputClasses, textareaClasses } from "../ui";
import { ModelSelect } from "../settings/ModelSelect";
import { buildDefaultRecastPreset } from "../../lib/recastDefaults";
import { t, useT } from "../../i18n";

function newPass(): RecastPass {
  return {
    id: crypto.randomUUID(),
    // Default name of a new pass: interface copy, so it is resolved when the pass is created.
    name: t("presets.recast.newPass"),
    enabled: true,
    contextLength: 10,
    prompt: "",
    includeCharCard: true,
    includeSceneContext: true,
  };
}

function PassEditor({
  pass,
  models,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  pass: RecastPass;
  models: ModelDescriptor[];
  onChange: (next: RecastPass) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const t = useT();

  return (
    <Card className="mb-3">
      <div className="flex items-center gap-2">
        <Toggle checked={pass.enabled} onChange={(enabled) => onChange({ ...pass, enabled })} />
        <input
          value={pass.name}
          onChange={(e) => onChange({ ...pass, name: e.target.value })}
          className={`${inputClasses} flex-1`}
        />
        <button
          onClick={onMoveUp}
          aria-label={t("presets.recast.moveUp")}
          title={t("presets.recast.moveUp")}
          className="cursor-pointer rounded p-1.5 text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-text"
        >
          <ChevronUp size={16} />
        </button>
        <button
          onClick={onMoveDown}
          aria-label={t("presets.recast.moveDown")}
          title={t("presets.recast.moveDown")}
          className="cursor-pointer rounded p-1.5 text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-text"
        >
          <ChevronDown size={16} />
        </button>
        <button
          onClick={onRemove}
          aria-label={t("presets.recast.removePass")}
          title={t("presets.recast.removePass")}
          className="cursor-pointer rounded p-1.5 text-text-muted transition-colors hover:bg-danger/15 hover:text-danger"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("presets.recast.contextLabel")}>
          <input
            type="number"
            value={pass.contextLength}
            onChange={(e) => onChange({ ...pass, contextLength: Number(e.target.value) })}
            className={inputClasses}
          />
        </Field>
        <Field label={t("presets.recast.modelLabel")} hint={t("presets.recast.modelHint")}>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <ModelSelect
                models={models}
                value={pass.model ?? ""}
                onChange={(id) => onChange({ ...pass, model: id })}
                placeholder={t("presets.recast.modelPlaceholder")}
              />
            </div>
            {pass.model && (
              <button
                onClick={() => onChange({ ...pass, model: undefined })}
                title={t("presets.recast.useDefault")}
                className="cursor-pointer rounded p-1.5 text-text-muted transition-colors hover:text-text"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap gap-4">
        <Toggle
          checked={pass.includeCharCard}
          onChange={(includeCharCard) => onChange({ ...pass, includeCharCard })}
          label={t("presets.recast.includeCharacter")}
        />
        <Toggle
          checked={pass.includeSceneContext}
          onChange={(includeSceneContext) => onChange({ ...pass, includeSceneContext })}
          label={t("presets.recast.includeRecentHistory")}
        />
      </div>

      <Field label={t("presets.recast.passPromptLabel")} hint={t("presets.recast.passPromptHint")} className="mt-3">
        <textarea
          value={pass.prompt}
          onChange={(e) => onChange({ ...pass, prompt: e.target.value })}
          rows={6}
          placeholder={t("presets.recast.passPromptPlaceholder")}
          className={textareaClasses}
        />
      </Field>
    </Card>
  );
}

export function RecastPresetManager() {
  const t = useT();
  const { presets, create, update, remove } = useRecastPresets();
  const { models } = useActiveProviderModels();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [passes, setPasses] = useState<RecastPass[]>([]);

  function startEdit(preset: RecastPreset) {
    setEditingId(preset.id);
    setIsCreating(false);
    setName(preset.name);
    setPasses(preset.passes);
  }

  function startCreate() {
    setEditingId(null);
    setIsCreating(true);
    setName(t("presets.shared.newPreset"));
    setPasses([]);
  }

  function loadExamplePreset() {
    const preset = buildDefaultRecastPreset();
    void create({ name: preset.name, passes: preset.passes });
  }

  function cancelForm() {
    setEditingId(null);
    setIsCreating(false);
  }

  function updatePass(index: number, next: RecastPass) {
    setPasses((prev) => prev.map((p, i) => (i === index ? next : p)));
  }

  function removePass(index: number) {
    setPasses((prev) => prev.filter((_, i) => i !== index));
  }

  function movePass(index: number, direction: -1 | 1) {
    setPasses((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSave() {
    if (!name.trim()) return;
    if (editingId) await update(editingId, { name, passes });
    else await create({ name, passes });
    setEditingId(null);
    setIsCreating(false);
  }

  const showForm = isCreating || !!editingId;

  return (
    <div>
      <PageHeader
        icon={ListOrdered}
        title={t("presets.recast.title")}
        description={t("presets.recast.description")}
      />

      <div className="flex flex-col gap-2">
        {presets.length === 0 && !showForm && (
          <p className="text-sm text-text-muted">{t("presets.recast.empty")}</p>
        )}
        {presets.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg-elevated px-3 py-2">
            <span className="text-sm text-text">
              {p.name} <span className="text-text-faint">{t("presets.recast.passCount", { count: p.passes.length })}</span>
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
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={startCreate}>
            <Plus size={16} />
            {t("presets.shared.newPreset")}
          </Button>
          <Button variant="secondary" onClick={loadExamplePreset}>
            {t("presets.recast.loadExamples")}
          </Button>
        </div>
      )}

      {showForm && (
        <div className="mt-4">
          <Field label={t("presets.shared.presetName")} className="mb-4">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClasses} />
          </Field>

          {passes.map((pass, i) => (
            <PassEditor
              key={pass.id}
              pass={pass}
              models={models}
              onChange={(next) => updatePass(i, next)}
              onRemove={() => removePass(i)}
              onMoveUp={() => movePass(i, -1)}
              onMoveDown={() => movePass(i, 1)}
            />
          ))}
          <Button variant="secondary" onClick={() => setPasses((prev) => [...prev, newPass()])}>
            <Plus size={16} />
            {t("presets.recast.addPass")}
          </Button>

          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={handleSave}>
              {t("presets.shared.savePreset")}
            </Button>
            <Button variant="ghost" onClick={cancelForm}>
              {t("common.actions.cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
