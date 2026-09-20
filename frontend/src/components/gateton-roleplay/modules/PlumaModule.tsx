import { useEffect, useState } from "react";
import { Check, Eye, Feather, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { usePluma } from "../../../hooks/usePluma";
import type { PlumaRule, PlumaSettings, PlumaTemplate } from "../../../types/pluma";
import { PLUMA_ENGLISH_TEXT, PLUMA_TEMPLATES } from "../../../types/pluma";
import { buildPlumaMacro } from "../../../lib/pluma";
import { Button, Toggle, textareaClasses } from "../../ui";
import { useT } from "../../../i18n";

export function PlumaModuleContent() {
  const t = useT();
  const { settings, update } = usePluma();
  const [form, setForm] = useState<PlumaSettings | null>(null);
  const [status, setStatus] = useState("");
  const [templateOpen, setTemplateOpen] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  if (!form) {
    return <div className="flex justify-center py-16 text-text-muted">{t("common.state.loading")}</div>;
  }

  function set<K extends keyof PlumaSettings>(key: K, value: PlumaSettings[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function patchRule(id: string, patch: Partial<PlumaRule>) {
    setForm((f) => (f ? { ...f, rules: f.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : f));
  }

  function addRule(template?: PlumaTemplate) {
    const english = template ? PLUMA_ENGLISH_TEXT[template.id] : undefined;
    const rule: PlumaRule = template
      ? {
          id: crypto.randomUUID(),
          enabled: template.enabled,
          title: english?.title ?? t(template.nameKey),
          instruction: english?.instruction ?? t(template.instructionKey),
          example: english?.example ?? "",
        }
      : { id: crypto.randomUUID(), enabled: true, title: t("roleplay.pluma.newRule"), instruction: "", example: "" };
    setForm((f) => (f ? { ...f, rules: [...f.rules, rule] } : f));
    setTemplateOpen(false);
  }

  function removeRule(id: string) {
    setForm((f) => (f ? { ...f, rules: f.rules.filter((r) => r.id !== id) } : f));
  }

  async function handleSave() {
    if (!form) return;
    await update(form);
    setStatus(t("roleplay.saved"));
    setTimeout(() => setStatus(""), 2000);
  }

  const preview = buildPlumaMacro(form);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-2/15">
          <Feather size={22} className="text-accent-2" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold text-text">{t("roleplay.pluma.title")}</h2>
          <p className="mt-0.5 text-sm text-text-muted">
            {t("roleplay.pluma.description")}
          </p>
        </div>
        <Toggle checked={form.enabled} onChange={(v) => set("enabled", v)} label={t("roleplay.toggle.enabled")} />
      </div>

      {/* Rules */}
      <div className="flex flex-col gap-3">
        {form.rules.map((rule) => (
          <RuleCard key={rule.id} rule={rule} onPatch={(p) => patchRule(rule.id, p)} onRemove={() => removeRule(rule.id)} />
        ))}
        {form.rules.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center">
            <Feather size={22} className="text-text-faint" />
            <p className="text-sm text-text-faint">{t("roleplay.pluma.empty")}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => addRule()}>
          <Plus size={14} />
          {t("roleplay.pluma.addRule")}
        </Button>
        <div className="relative">
          <Button variant="secondary" size="sm" onClick={() => setTemplateOpen((o) => !o)}>
            <Wand2 size={14} />
            {t("roleplay.pluma.insertTemplate")}
          </Button>
          {templateOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 w-72 overflow-hidden rounded-lg border border-border bg-bg-elevated shadow-xl">
              {PLUMA_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => addRule(template)}
                  className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left text-xs text-text transition-colors hover:bg-bg-hover"
                >
                  <Sparkles size={13} className="shrink-0 text-accent-2" />
                  <span className="shrink-0 font-medium">{t(template.nameKey)}</span>
                  <span className="ml-auto truncate text-[10px] text-text-faint">{t(template.instructionKey).slice(0, 34)}…</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-2xl border border-border bg-bg-elevated p-5">
        <div className="mb-3 flex items-baseline gap-2">
          <Eye size={15} className="translate-y-0.5 text-accent" />
          <h4 className="text-sm font-semibold text-text">{t("roleplay.pluma.preview")}</h4>
          <span className="text-xs text-text-faint">{t("roleplay.pluma.previewHint")}</span>
        </div>
        {preview ? (
          <pre className="whitespace-pre-wrap rounded-xl border border-border bg-bg-elevated-2 p-4 font-mono text-xs leading-relaxed text-text-muted">
            {preview}
          </pre>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-4 text-xs text-text-faint">
            {t("roleplay.pluma.disabled")}
          </p>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={handleSave}>
          <Check size={14} />
          {t("common.actions.save")}
        </Button>
        {status && <span className="text-xs text-text-muted">{status}</span>}
      </div>
    </div>
  );
}

function RuleCard({
  rule,
  onPatch,
  onRemove,
}: {
  rule: PlumaRule;
  onPatch: (patch: Partial<PlumaRule>) => void;
  onRemove: () => void;
}) {
  const t = useT();

  return (
    <div
      className={`rounded-2xl border p-4 transition-all duration-200 ${
        rule.enabled ? "border-border bg-bg-elevated hover:border-border-strong" : "border-border bg-bg-elevated/40 opacity-70"
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <input
          value={rule.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder={t("roleplay.pluma.ruleTitle")}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-text outline-none placeholder:text-text-faint"
        />
        <Toggle checked={rule.enabled} onChange={(v) => onPatch({ enabled: v })} />
        <button
          onClick={onRemove}
          className="cursor-pointer rounded-md p-1.5 text-text-faint transition-colors hover:bg-bg-hover hover:text-danger"
          title={t("roleplay.pluma.deleteRule")}
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="flex flex-col gap-2.5">
        <textarea
          value={rule.instruction}
          onChange={(e) => onPatch({ instruction: e.target.value })}
          rows={2}
          placeholder={t("roleplay.pluma.instruction")}
          className={textareaClasses}
        />
        <div className="flex items-start gap-2">
          <span className="mt-2 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-text-faint">{t("roleplay.pluma.exampleBadge")}</span>
          <textarea
            value={rule.example}
            onChange={(e) => onPatch({ example: e.target.value })}
            rows={1}
            placeholder={t("roleplay.pluma.example")}
            className={textareaClasses}
          />
        </div>
      </div>
    </div>
  );
}
