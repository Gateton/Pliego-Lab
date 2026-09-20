import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { BookMarked, ImagePlus, ImageUp, Loader2, Pencil, Plus, Sparkles, Trash2, UserCircle } from "lucide-react";
import { usePersonas } from "../../hooks/usePersonas";
import * as personasApi from "../../api/personas";
import * as npcTrackerApi from "../../api/npcTracker";
import * as lorebooksApi from "../../api/lorebooks";
import type { Persona } from "../../types/persona";
import type { NpcField } from "../../types/npcTracker";
import type { Lorebook } from "../../types/lorebook";
import { useT } from "../../i18n";
import { Button, Card, Field, PageHeader, inputClasses, textareaClasses } from "../ui";
import { DossierFieldInput } from "../npc/DossierFieldInput";

export function PersonaManager() {
  const t = useT();
  const { personas, create, update, remove } = usePersonas();
  const [fields, setFields] = useState<NpcField[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [avatar, setAvatar] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [error, setError] = useState("");
  const [lorebookId, setLorebookId] = useState<string | null>(null);
  const [lorebooks, setLorebooks] = useState<Lorebook[]>([]);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    npcTrackerApi.getNpcTrackerSettings().then((s) => setFields(s.fields));
    lorebooksApi.listLorebooks().then(setLorebooks).catch(() => setLorebooks([]));
  }, []);

  function startEdit(persona: Persona) {
    setEditingId(persona.id);
    setName(persona.name);
    setDescription(persona.description);
    setAvatar(persona.avatar ?? "");
    setValues(persona.values ?? {});
    setLorebookId(persona.lorebookId ?? null);
    setIsCreating(false);
    setError("");
  }

  function startCreate() {
    setEditingId(null);
    setName("");
    setDescription("");
    setAvatar("");
    setValues({});
    setLorebookId(null);
    setIsCreating(true);
    setError("");
  }

  function cancelForm() {
    setEditingId(null);
    setIsCreating(false);
  }

  async function handleSave() {
    if (!name.trim()) return;
    if (editingId) {
      await update(editingId, { name, description, avatar, values, lorebookId });
    } else {
      await create({ name, description, avatar, values, lorebookId });
    }
    setEditingId(null);
    setIsCreating(false);
  }

  async function handleGenerate() {
    if (!description.trim()) return;
    setGenerating(true);
    setError("");
    try {
      const { values: generated } = await personasApi.generatePersonaDossier(description);
      setValues((prev) => ({ ...prev, ...generated }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("personas.error.dossier"));
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateAvatar() {
    const imageTags = values["imageTags"];
    if (!imageTags?.trim()) return;
    setGeneratingAvatar(true);
    setError("");
    try {
      const { pfp } = await npcTrackerApi.generateNpcPortrait(imageTags);
      setAvatar(pfp);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("personas.error.avatar"));
    } finally {
      setGeneratingAvatar(false);
    }
  }

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  }

  const showForm = isCreating || !!editingId;

  return (
    <div>
      <PageHeader
        icon={UserCircle}
        title={t("personas.title")}
        description={t("personas.description")}
      />

      <div className="flex flex-col gap-2">
        {personas.length === 0 && !showForm && (
          <p className="text-sm text-text-muted">{t("personas.empty")}</p>
        )}
        {personas.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg-elevated px-3 py-2">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              {p.avatar ? (
                <img src={p.avatar} alt={p.name} className="h-7 w-7 shrink-0 rounded-full border border-border object-cover" />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-bg-elevated-2 text-xs font-semibold text-text-muted">
                  {p.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="min-w-0">
                <strong className="text-text">{p.name}</strong>
                {p.description && <span className="text-text-muted"> — {p.description}</span>}
              </span>
            </span>
            <span className="flex shrink-0 gap-1">
              <button
                onClick={() => startEdit(p)}
                aria-label={t("personas.actions.edit")}
                title={t("characters.action.edit")}
                className="cursor-pointer rounded p-1.5 text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-text"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => remove(p.id)}
                aria-label={t("personas.actions.delete")}
                title={t("characters.action.delete")}
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
          {t("personas.create")}
        </Button>
      )}

      {showForm && (
        <Card className="mt-4 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            {avatar ? (
              <img src={avatar} alt={t("personas.form.avatarAlt")} className="h-16 w-16 rounded-md border border-border object-cover" />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-md border border-border bg-bg-elevated-2 text-lg font-semibold text-text-muted">
                {name.charAt(0).toUpperCase() || "?"}
              </span>
            )}
            <Button variant="secondary" onClick={() => avatarInputRef.current?.click()}>
              <ImageUp size={16} />
              {t("personas.form.changeAvatar")}
            </Button>
            <Button
              variant="secondary"
              onClick={handleGenerateAvatar}
              disabled={generatingAvatar || !values["imageTags"]?.trim()}
              title={!values["imageTags"]?.trim() ? t("personas.form.generateAvatarBlocked") : t("personas.form.generateAvatarTitle")}
            >
              {generatingAvatar ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              {t("personas.form.generateAvatar")}
            </Button>
            {avatar && (
              <Button variant="ghost" onClick={() => setAvatar("")}>
                {t("characters.action.remove")}
              </Button>
            )}
            <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
          </div>
          <Field label={t("characters.card.name")}>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClasses} />
          </Field>
          <Field
            label={t("personas.form.descriptionLabel")}
            hint={t("personas.form.descriptionHint")}
          >
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={textareaClasses} />
          </Field>
          <Field label={t("personas.form.lorebookLabel")} hint={t("personas.form.lorebookHint")}>
            <div className="flex items-center gap-2"><BookMarked size={16} className="text-accent" /><select className={inputClasses} value={lorebookId ?? ""} onChange={(e) => setLorebookId(e.target.value || null)}><option value="">{t("personas.form.lorebookNone")}</option>{lorebooks.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}</select></div>
          </Field>
          <div>
            <Button variant="secondary" onClick={handleGenerate} disabled={generating || !description.trim()}>
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {generating ? t("characters.action.generating") : t("personas.form.generateDossier")}
            </Button>
            <p className="mt-1 text-[11px] text-text-faint">
              {t("personas.form.generateNote")}
            </p>
          </div>

          {fields.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-border pt-3">
              {fields.map((f) => (
                <DossierFieldInput
                  key={f.key}
                  field={f}
                  value={values[f.key] ?? ""}
                  onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
                />
              ))}
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-2">
            <Button variant="primary" onClick={handleSave}>
              {t("common.actions.save")}
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
