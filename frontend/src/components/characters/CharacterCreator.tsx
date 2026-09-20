import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Check, Globe2, ImagePlus, ImageUp, Loader2, Plus, Search, Sparkles, UserRound, Wand2, X } from "lucide-react";
import * as charactersApi from "../../api/characters";
import { getUserCharacters } from "../../lib/characterVisibility";
import * as npcTrackerApi from "../../api/npcTracker";
import type { CharacterCard, CharacterSummary } from "../../types/character";
import { useT } from "../../i18n";
import type { TranslationKey } from "../../i18n";
import { Button, Card, Field, Modal, PageHeader, Toggle, inputClasses, textareaClasses } from "../ui";

type DraftCard = Omit<CharacterCard, "id">;
type DraftFieldKey = keyof Omit<CharacterCard, "id" | "isWorld" | "tags">;
type FieldChange = { before: string; after: string; kind: "new" | "changed" };

const TEXT_FIELDS: { key: DraftFieldKey; labelKey: TranslationKey; rows: number; hintKey?: TranslationKey }[] = [
  { key: "name", labelKey: "characters.card.name", rows: 1 },
  { key: "description", labelKey: "characters.card.description", rows: 5, hintKey: "characters.creator.hint.description" },
  { key: "personality", labelKey: "characters.card.personality", rows: 4, hintKey: "characters.creator.hint.personality" },
  { key: "scenario", labelKey: "characters.card.scenario", rows: 4, hintKey: "characters.creator.hint.scenario" },
  { key: "first_mes", labelKey: "characters.card.firstMessageGreeting", rows: 6, hintKey: "characters.creator.hint.firstMessage" },
  { key: "mes_example", labelKey: "characters.card.dialogueExamples", rows: 5, hintKey: "characters.creator.hint.dialogueExamples" },
  { key: "system_prompt", labelKey: "characters.card.systemPrompt", rows: 5, hintKey: "characters.creator.hint.systemPrompt" },
  { key: "post_history_instructions", labelKey: "characters.card.postHistoryInstructions", rows: 4, hintKey: "characters.creator.hint.postHistoryInstructions" },
  { key: "imageTags", labelKey: "characters.card.imageTags", rows: 4, hintKey: "characters.creator.hint.imageTags" },
  { key: "creator_notes", labelKey: "characters.card.creatorNotes", rows: 3, hintKey: "characters.creator.hint.creatorNotes" },
  { key: "creator", labelKey: "characters.card.creator", rows: 1 },
  { key: "character_version", labelKey: "characters.card.version", rows: 1 },
];

/** Buttons of the context picker. Spelled out so the keys stay type-checked. */
const CONTEXT_FILTER_KEYS: Record<"all" | "characters" | "worlds", TranslationKey> = {
  all: "characters.creator.context.filter.all",
  characters: "characters.creator.context.filter.characters",
  worlds: "characters.creator.context.filter.worlds",
};

function fieldValue(value: unknown): string {
  return Array.isArray(value) ? value.join(", ") : String(value ?? "");
}

const EMPTY_CARD: Omit<CharacterCard, "id"> = {
  name: "",
  description: "",
  personality: "",
  scenario: "",
  first_mes: "",
  mes_example: "",
  creator_notes: "",
  system_prompt: "",
  post_history_instructions: "",
  tags: [],
  imageTags: "",
  creator: "Pliego Lab Character Creator",
  character_version: "1.0",
  isWorld: false,
};

export function CharacterCreator({ onSaved }: { onSaved?: () => void }) {
  const t = useT();
  const [description, setDescription] = useState("");
  const [contextId, setContextId] = useState("");
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [contextSearch, setContextSearch] = useState("");
  const [contextFilter, setContextFilter] = useState<"all" | "characters" | "worlds">("all");
  const [contextPickerOpen, setContextPickerOpen] = useState(false);
  const [isWorld, setIsWorld] = useState(false);
  const [draft, setDraft] = useState<DraftCard | null>(null);
  const [fieldChanges, setFieldChanges] = useState<Partial<Record<DraftFieldKey, FieldChange>>>({});
  const [refinement, setRefinement] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [generationRawResponse, setGenerationRawResponse] = useState("");
  const [generationReasoning, setGenerationReasoning] = useState("");
  const [generationErrorOpen, setGenerationErrorOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const userCharacters = getUserCharacters(characters);
  const selectedContext = userCharacters.find((character) => character.id === contextId) ?? null;
  const filteredContexts = userCharacters.filter((character) => {
    const matchesSearch = !contextSearch.trim() || character.name.toLowerCase().includes(contextSearch.trim().toLowerCase()) || character.tags.some((tag) => tag.toLowerCase().includes(contextSearch.trim().toLowerCase()));
    const matchesFilter = contextFilter === "all" || (contextFilter === "worlds" ? character.isWorld === true : character.isWorld !== true);
    return matchesSearch && matchesFilter;
  });

  useEffect(() => {
    charactersApi.listCharacters().then(setCharacters).catch(() => setCharacters([]));
  }, []);

  function updateDraft<K extends keyof DraftCard>(key: K, value: DraftCard[K]) {
    setDraft((previous) => (previous ? { ...previous, [key]: value } : previous));
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type !== "image/png") {
      setError(t("characters.creator.error.pngRequired"));
      return;
    }
    setError("");
    setImageFile(file);
    setGeneratedImageUrl("");
    const reader = new FileReader();
    reader.onload = () => setImagePreview(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  }

  function clearDraft() {
    setDraft(null);
    setFieldChanges({});
    setRefinement("");
    setError("");
    setGenerationRawResponse("");
    setGenerationReasoning("");
  }

  function selectContext(id: string) {
    setContextId(id);
    setContextPickerOpen(false);
    setContextSearch("");
  }

  async function generate(refine = false) {
    if (!description.trim() || (refine && !refinement.trim())) return;
    const previousDraft = refine ? draft : null;
    setGenerating(true);
      setError("");
      setGenerationRawResponse("");
      setGenerationReasoning("");
    setGenerationErrorOpen(false);
    try {
      const result = await charactersApi.generateCharacter({
        description: description.trim(),
        contextCharacterId: contextId || null,
        isWorld,
        draft: refine ? draft : null,
        refinement: refine ? refinement.trim() : "",
      });
      const nextDraft = { ...EMPTY_CARD, ...result.fields, isWorld };
      const changes: Partial<Record<DraftFieldKey, FieldChange>> = {};
      for (const field of TEXT_FIELDS) {
        const before = fieldValue(previousDraft?.[field.key]);
        const after = fieldValue(nextDraft[field.key]);
        if ((!refine && after) || (refine && before !== after)) {
          changes[field.key] = { before, after, kind: before ? "changed" : "new" };
        }
      }
      setDraft(nextDraft);
      setFieldChanges(changes);
      if (refine) setRefinement("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("characters.creator.error.generate"));
      setGenerationRawResponse(err instanceof charactersApi.CharacterGenerationError ? err.rawResponse : "");
      setGenerationReasoning(err instanceof charactersApi.CharacterGenerationError ? err.reasoning : "");
    } finally {
      setGenerating(false);
    }
  }

  async function generateImage() {
    const imageTags = draft?.imageTags?.trim();
    if (!imageTags) return;
    setGeneratingImage(true);
    setError("");
    try {
      const { pfp } = await npcTrackerApi.generateNpcPortrait(imageTags);
      setImageFile(null);
      setGeneratedImageUrl(pfp);
      setImagePreview(pfp);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("characters.creator.error.image"));
    } finally {
      setGeneratingImage(false);
    }
  }

  async function generatedUrlToFile(url: string): Promise<File> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(t("characters.creator.error.portraitDownload"));
    const blob = await response.blob();
    return new File([blob], "character-portrait.png", { type: blob.type || "image/png" });
  }

  async function save() {
    if (!draft?.name.trim()) {
      setError(t("characters.creator.error.nameRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created = await charactersApi.createCharacter({ ...draft, name: draft.name.trim() });
      const imageToSave = imageFile ?? (generatedImageUrl ? await generatedUrlToFile(generatedImageUrl) : null);
      if (imageToSave) await charactersApi.replaceImage(created.id, imageToSave);
      onSaved?.();
      setDraft(null);
      setFieldChanges({});
      setDescription("");
      setContextId("");
      setImageFile(null);
      setGeneratedImageUrl("");
      setImagePreview("");
      setGenerationRawResponse("");
      setGenerationReasoning("");
      setCharacters(await charactersApi.listCharacters());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("characters.creator.error.save"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        icon={Wand2}
        title={t("characters.creator.title")}
        description={t("characters.creator.description")}
      />

      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <Field label={t("characters.creator.idea.label")} hint={t("characters.creator.idea.hint")}>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={8}
              className={textareaClasses}
              placeholder={t("characters.creator.idea.placeholder")}
            />
          </Field>

          <div className="rounded-xl border border-border bg-bg-elevated-2/40 p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Globe2 size={16} className="text-accent-2" />
                  <h3 className="text-sm font-semibold text-text">{t("characters.creator.context.title")}</h3>
                  <span className="rounded-full border border-border bg-bg-elevated px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-faint">{t("characters.creator.context.optional")}</span>
                </div>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-text-muted">{t("characters.creator.context.description")}</p>
              </div>
              {selectedContext && (
                <button type="button" onClick={() => setContextId("")} className="cursor-pointer rounded-md p-1.5 text-text-faint transition-colors hover:bg-bg-elevated hover:text-text" title={t("characters.creator.context.remove")} aria-label={t("characters.creator.context.remove")}>
                  <X size={15} />
                </button>
              )}
            </div>

            {selectedContext ? (
              <button type="button" onClick={() => setContextPickerOpen((open) => !open)} className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-accent/40 bg-accent/10 p-3 text-left transition-colors hover:bg-accent/15">
                <img src={charactersApi.thumbnailUrl(selectedContext.id, 96, selectedContext.mtimeMs)} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-text">
                    {selectedContext.name}
                    <span className="rounded-full bg-bg-elevated px-1.5 py-0.5 text-[10px] font-normal text-text-muted">{selectedContext.isWorld ? t("characters.creator.context.world") : t("characters.creator.context.character")}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-text-muted">{t("characters.creator.context.reference")}</span>
                </span>
                <span className="text-xs text-accent">{t("characters.creator.context.change")}</span>
              </button>
            ) : (
              <button type="button" onClick={() => setContextPickerOpen((open) => !open)} className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border-strong bg-bg-elevated/50 p-3 text-left transition-colors hover:border-accent/60 hover:bg-bg-elevated">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-bg-elevated-2 text-text-faint"><Search size={17} /></span>
                <span className="flex-1"><span className="block text-sm font-medium text-text">{t("characters.creator.context.searchCta")}</span><span className="block text-xs text-text-muted">{t("characters.creator.context.searchHint")}</span></span>
              <span className="text-xs text-text-faint">{t("characters.creator.context.available", { count: userCharacters.length })}</span>
              </button>
            )}

            {contextPickerOpen && (
              <div className="mt-3 overflow-hidden rounded-lg border border-border bg-bg-elevated shadow-lg">
                <div className="border-b border-border p-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
                    <input autoFocus value={contextSearch} onChange={(event) => setContextSearch(event.target.value)} placeholder={t("characters.creator.context.searchPlaceholder")} className={`${inputClasses} pl-9`} />
                  </div>
                  <div className="mt-2 flex gap-1">
                    {(["all", "characters", "worlds"] as const).map((filter) => (
                      <button key={filter} type="button" onClick={() => setContextFilter(filter)} className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] transition-colors ${contextFilter === filter ? "bg-accent text-bg" : "text-text-muted hover:bg-bg-elevated-2 hover:text-text"}`}>
                        {t(CONTEXT_FILTER_KEYS[filter])}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto p-2">
                  {filteredContexts.length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-text-faint">{t("characters.creator.context.noMatches")}</p>
                  ) : (
                    <div className="grid gap-1 sm:grid-cols-2">
                      {filteredContexts.map((character) => (
                        <button key={character.id} type="button" onClick={() => selectContext(character.id)} className={`group flex cursor-pointer items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-bg-elevated-2 ${contextId === character.id ? "bg-accent/10" : ""}`}>
                          <img src={charactersApi.thumbnailUrl(character.id, 64, character.mtimeMs)} alt="" loading="lazy" decoding="async" className="h-10 w-10 shrink-0 rounded-md border border-border bg-bg-elevated-2 object-cover" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-text">{character.name}</span>
                            <span className="mt-0.5 flex items-center gap-1 text-[10px] text-text-faint">
                              {character.isWorld ? <Globe2 size={10} /> : <UserRound size={10} />}
                              {character.isWorld ? t("characters.creator.context.world") : t("characters.creator.context.character")}
                            </span>
                          </span>
                          {contextId === character.id && <Check size={14} className="shrink-0 text-accent" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-end">
              <Toggle
                checked={isWorld}
                onChange={setIsWorld}
                label={t("characters.creator.worldToggle.label")}
                hint={t("characters.creator.worldToggle.hint")}
              />
            </div>
          </div>

            <div className="flex flex-wrap items-center gap-3">
            {imagePreview ? (
              <img src={imagePreview} alt={t("characters.creator.image.alt")} className="h-20 w-20 rounded-md border border-border object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-border text-xs text-text-faint">{t("characters.creator.image.empty")}</div>
            )}
            <Button variant="secondary" onClick={() => imageInputRef.current?.click()}>
              <ImageUp size={16} />
              {t("characters.creator.image.upload")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void generateImage()}
              disabled={generatingImage || !draft?.imageTags?.trim()}
              title={!draft?.imageTags?.trim() ? t("characters.creator.image.needTags") : t("characters.creator.image.generateHint")}
            >
              {generatingImage ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              {generatingImage ? t("characters.creator.image.generating") : t("characters.creator.image.generate")}
            </Button>
            <input ref={imageInputRef} type="file" accept="image/png" hidden onChange={handleImageChange} />
            {(imageFile || generatedImageUrl) && <Button variant="ghost" onClick={() => { setImageFile(null); setGeneratedImageUrl(""); setImagePreview(""); }}><X size={14} /> {t("characters.action.remove")}</Button>}
          </div>

          <Button variant="primary" onClick={() => void generate()} disabled={generating || !description.trim()}>
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? t("characters.action.generating") : t("characters.creator.generate")}
          </Button>
        </Card>

        {error && (generationRawResponse || generationReasoning) ? (
          <button
            type="button"
            onClick={() => setGenerationErrorOpen(true)}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger/15"
          >
            <span>{error}</span>
            <span className="shrink-0 text-xs font-semibold underline underline-offset-2">{t("characters.creator.errorDetails")}</span>
          </button>
        ) : error ? (
          <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        ) : null}

        {draft && (
          <Card className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-text">{t("characters.creator.draft.title")}</h3>
                <p className="text-xs text-text-muted">{t("characters.creator.draft.description")}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={clearDraft}><X size={14} /> {t("characters.action.discard")}</Button>
            </div>

            {Object.keys(fieldChanges).length > 0 && (
              <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-accent">{t("characters.creator.changes.title")}</h4>
                  <span className="text-[11px] text-text-muted">{Object.keys(fieldChanges).length} {Object.keys(fieldChanges).length === 1 ? t("characters.creator.changes.field") : t("characters.creator.changes.fields")}</span>
                </div>
                <p className="mt-1 text-xs text-text-muted">{t("characters.creator.changes.hint")}</p>
                <div className="mt-3 flex flex-col gap-2">
                  {TEXT_FIELDS.filter((field) => fieldChanges[field.key]).map((field) => {
                    const change = fieldChanges[field.key];
                    if (!change) return null;
                    return (
                      <details key={field.key} className="rounded-md border border-border bg-bg-elevated/60 px-3 py-2">
                        <summary className="cursor-pointer text-xs font-medium text-text">
                          {t(field.labelKey)}
                          <span className="ml-2 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-accent">
                            {change.kind === "new" ? t("characters.creator.changes.new") : t("characters.creator.changes.changed")}
                          </span>
                        </summary>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <div>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-faint">{t("characters.creator.changes.before")}</p>
                            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-bg px-2 py-2 text-xs text-text-muted">{change.before || t("characters.creator.changes.empty")}</pre>
                          </div>
                          <div>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-accent">{t("characters.creator.changes.new")}</p>
                            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-accent/30 bg-accent/5 px-2 py-2 text-xs text-text">{change.after || t("characters.creator.changes.empty")}</pre>
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            )}

            {TEXT_FIELDS.map((field) => {
              const change = fieldChanges[field.key];
              return (
                <div key={field.key} className={change ? "rounded-lg border border-accent/30 bg-accent/5 p-3" : ""}>
                  {change && (
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-accent">
                      <span className="rounded-full bg-accent/15 px-1.5 py-0.5">{change.kind === "new" ? t("characters.creator.changes.new") : t("characters.creator.changes.changed")}</span>
                      <span className="font-normal normal-case tracking-normal text-text-muted">{t("characters.creator.changes.notice")}</span>
                    </div>
                  )}
                  <Field label={t(field.labelKey)} hint={field.hintKey ? t(field.hintKey) : undefined}>
                    <textarea
                      value={String(draft[field.key] ?? "")}
                      onChange={(event) => updateDraft(field.key, event.target.value)}
                      rows={field.rows}
                      className={change ? `${textareaClasses} border-accent/50 bg-accent/5` : textareaClasses}
                    />
                  </Field>
                </div>
              );
            })}

            <Field label={t("characters.card.tags")} hint={t("characters.creator.tagsHint")}>
              <input
                value={draft.tags.join(", ")}
                onChange={(event) => updateDraft("tags", event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))}
                className={inputClasses}
              />
            </Field>

            <div className="rounded-md border border-accent/30 bg-accent/5 p-3">
              <Field label={t("characters.creator.refine.label")} hint={t("characters.creator.refine.hint")}>
                <textarea
                  value={refinement}
                  onChange={(event) => setRefinement(event.target.value)}
                  rows={4}
                  className={textareaClasses}
                  placeholder={t("characters.creator.refine.placeholder")}
                />
              </Field>
              <Button variant="secondary" className="mt-3" onClick={() => void generate(true)} disabled={generating || !refinement.trim()}>
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {generating ? t("characters.creator.refine.busy") : t("characters.creator.refine.action")}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button variant="primary" onClick={() => void save()} disabled={saving || generating}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {saving ? t("characters.action.saving") : t("characters.creator.save.action")}
              </Button>
              <span className="text-xs text-text-faint">{t("characters.creator.save.hint")}</span>
            </div>
          </Card>
        )}
      </div>
      {generationErrorOpen && (generationRawResponse || generationReasoning) && (
        <Modal title={t("characters.creator.diagnosis.title")} description={t("characters.creator.diagnosis.description")} onClose={() => setGenerationErrorOpen(false)} size="lg">
          <div className="flex max-h-[65vh] flex-col gap-4 overflow-auto">
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">{t("characters.creator.diagnosis.reasoningTitle")}</h3>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-accent/30 bg-accent/5 px-3 py-3 font-mono text-xs leading-relaxed text-text">
                {generationReasoning || t("characters.creator.diagnosis.reasoningEmpty")}
              </pre>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t("characters.creator.diagnosis.responseTitle")}</h3>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-bg px-3 py-3 font-mono text-xs leading-relaxed text-text">
                {generationRawResponse || t("characters.creator.diagnosis.responseEmpty")}
              </pre>
            </section>
          </div>
        </Modal>
      )}
    </div>
  );
}
