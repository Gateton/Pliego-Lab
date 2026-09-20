import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, RotateCcw, ScanSearch, Trash2, X } from "lucide-react";
import * as npcTrackerApi from "../../api/npcTracker";
import { useT } from "../../i18n";
import type { TranslationKey } from "../../i18n";
import type { NpcField, NpcFieldKind, NpcTrackerSettings } from "../../types/npcTracker";
import { DEFAULT_NPC_FIELDS } from "../../lib/npcTracker";
import { useActiveProviderModels } from "../../hooks/useProviderModels";
import { ModelSelect } from "../settings/ModelSelect";
import { Button, Field, PageHeader, Toggle, inputClasses } from "../ui";

/** Kind → label key, in the order the select shows them. Written as pairs rather than a record
 * because the i18n guard reads a `text` property name as visible copy. */
const KIND_LABEL_KEYS: Array<[NpcFieldKind, TranslationKey]> = [
  ["text", "npc.settings.kind.text"],
  ["textarea", "npc.settings.kind.textarea"],
  ["tags", "npc.settings.kind.tags"],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-bg-elevated p-4">
      <h3 className="mb-3 font-display text-sm font-semibold text-text">{title}</h3>
      {children}
    </section>
  );
}

export function NpcTrackerSettingsPanel() {
  const t = useT();
  const [form, setForm] = useState<NpcTrackerSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { models } = useActiveProviderModels();

  useEffect(() => {
    npcTrackerApi.getNpcTrackerSettings().then(setForm);
  }, []);

  if (!form) return <p className="text-text-muted">{t("common.state.loading")}</p>;

  function set<K extends keyof NpcTrackerSettings>(key: K, value: NpcTrackerSettings[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function updateField(key: string, patch: Partial<NpcField>) {
    setForm((f) => (f ? { ...f, fields: f.fields.map((x) => (x.key === key ? { ...x, ...patch } : x)) } : f));
  }

  function addField() {
    setForm((f) => (f ? { ...f, fields: [...f.fields, { key: `f_${Date.now()}`, label: t("npc.settings.fields.newFieldDefault"), kind: "text" }] } : f));
  }

  function removeField(key: string) {
    setForm((f) => (f ? { ...f, fields: f.fields.filter((x) => x.key !== key) } : f));
  }

  function moveField(key: string, delta: number) {
    setForm((f) => {
      if (!f) return f;
      const fields = [...f.fields];
      const i = fields.findIndex((x) => x.key === key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= fields.length) return f;
      [fields[i], fields[j]] = [fields[j], fields[i]];
      return { ...f, fields };
    });
  }

  function resetFields() {
    // The built-in defaults keep only the key of their label in the module; the label itself is
    // resolved here, so a reset restores the wording of the language the interface is in.
    setForm((f) =>
      f ? { ...f, fields: DEFAULT_NPC_FIELDS.map(({ labelKey, ...field }) => ({ ...field, label: t(labelKey) })) } : f,
    );
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await npcTrackerApi.updateNpcTrackerSettings(form!);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        icon={ScanSearch}
        title={t("chrome.modal.npc")}
        description={t("npc.settings.description")}
      />

      <div className="mb-5">
        <Toggle
          checked={form.enabled}
          onChange={(v) => set("enabled", v)}
          label={t("npc.settings.enabled.label")}
          hint={t("npc.settings.enabled.hint")}
        />
      </div>

      <div className="flex flex-col gap-4">
        <Section title={t("npc.settings.sections.model")}>
          <Field label={t("npc.settings.model.label")} hint={t("npc.settings.model.hint")}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <ModelSelect models={models} value={form.model} onChange={(id) => set("model", id)} placeholder={t("npc.settings.model.placeholder")} />
              </div>
              {form.model && (
                <button onClick={() => set("model", "")} title={t("npc.settings.model.clear")} className="mt-1 shrink-0 cursor-pointer rounded p-1 text-text-faint transition-colors hover:text-text">
                  <X size={14} />
                </button>
              )}
            </div>
          </Field>
        </Section>

        <Section title={t("npc.settings.sections.autoScan")}>
          <Toggle
            checked={form.autoScan}
            onChange={(v) => set("autoScan", v)}
            label={t("npc.settings.autoScan.label")}
            hint={t("npc.settings.autoScan.hint")}
          />
          <div className="mt-3">
            <Field label={t("npc.settings.interval")} className="max-w-[10rem]">
              <input
                type="number"
                min={1}
                value={form.autoScanInterval}
                onChange={(e) => set("autoScanInterval", Math.max(1, Number(e.target.value) || 5))}
                className={inputClasses}
              />
            </Field>
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <Toggle
              checked={form.heuristicScan}
              onChange={(v) => set("heuristicScan", v)}
              label={t("npc.settings.heuristic.label")}
              hint={t("npc.settings.heuristic.hint")}
            />
          </div>
        </Section>

        <Section title={t("npc.settings.sections.mainCharacter")}>
          <Toggle
            checked={form.includeMainCharacter}
            onChange={(v) => set("includeMainCharacter", v)}
            label={t("npc.settings.mainCharacter.label")}
            hint={t("npc.settings.mainCharacter.hint")}
          />
        </Section>

        <Section title={t("npc.settings.sections.evolution")}>
          <Toggle
            checked={form.evolutionEnabled}
            onChange={(v) => set("evolutionEnabled", v)}
            label={t("npc.settings.evolution.label")}
            hint={t("npc.settings.evolution.hint")}
          />
          <div className="mt-3">
            <Field label={t("npc.settings.interval")} className="max-w-[10rem]">
              <input
                type="number"
                min={1}
                value={form.evolutionInterval}
                onChange={(e) => set("evolutionInterval", Math.max(1, Number(e.target.value) || 20))}
                className={inputClasses}
              />
            </Field>
          </div>
        </Section>

        <Section title={t("npc.settings.sections.fields")}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-text-faint">{t("npc.settings.fields.description")}</p>
            <Button variant="secondary" size="sm" onClick={addField}>
              <Plus size={14} /> {t("npc.settings.fields.add")}
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            {form.fields.map((f, i) => (
              <div key={f.key} className="flex items-center gap-2 rounded-md border border-border bg-bg px-2 py-1.5">
                <div className="flex flex-col">
                  <button
                    onClick={() => moveField(f.key, -1)}
                    disabled={i === 0}
                    aria-label={t("npc.settings.fields.moveUp")}
                    className="cursor-pointer rounded p-0.5 text-text-faint transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-25"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    onClick={() => moveField(f.key, 1)}
                    disabled={i === form.fields.length - 1}
                    aria-label={t("npc.settings.fields.moveDown")}
                    className="cursor-pointer rounded p-0.5 text-text-faint transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-25"
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>

                <input value={f.label} onChange={(e) => updateField(f.key, { label: e.target.value })} className={`${inputClasses} min-w-0 flex-1 py-1!`} />

                <select value={f.kind} onChange={(e) => updateField(f.key, { kind: e.target.value as NpcFieldKind })} className={`${inputClasses} w-28! py-1!`}>
                  {KIND_LABEL_KEYS.map(([value, labelKey]) => (
                    <option key={value} value={value}>
                      {t(labelKey)}
                    </option>
                  ))}
                </select>

                <select
                  value={f.evolveMode ?? "replace"}
                  onChange={(e) => updateField(f.key, { evolveMode: e.target.value as "append" | "replace" })}
                  title={t("npc.settings.fields.evolveModeHint")}
                  className={`${inputClasses} w-32! py-1!`}
                >
                  <option value="replace">{t("npc.settings.fields.evolveMode.replace")}</option>
                  <option value="append">{t("npc.settings.fields.evolveMode.append")}</option>
                </select>

                {f.builtin ? (
                  <span className="shrink-0 rounded bg-bg-elevated-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-faint">{t("npc.settings.fields.default")}</span>
                ) : (
                  <button
                    onClick={() => removeField(f.key)}
                    aria-label={t("npc.settings.fields.remove")}
                    className="shrink-0 cursor-pointer rounded p-1 text-text-muted transition-colors hover:bg-danger/15 hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button onClick={resetFields} className="mt-3 flex cursor-pointer items-center gap-1.5 text-xs text-accent transition-colors hover:text-accent-hover">
            <RotateCcw size={13} />
            {t("npc.settings.fields.reset")}
          </button>
        </Section>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? t("npc.settings.saving") : t("common.actions.save")}
        </Button>
        {saved && <span className="text-sm text-accent">{t("npc.settings.saved")}</span>}
      </div>
    </div>
  );
}
