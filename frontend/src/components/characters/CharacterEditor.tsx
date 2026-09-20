import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { BookMarked, ImageUp, Languages, Sparkles, UserCog } from "lucide-react";
import * as charactersApi from "../../api/characters";
import * as lorebooksApi from "../../api/lorebooks";
import type { CharacterCard } from "../../types/character";
import type { Lorebook } from "../../types/lorebook";
import { useT } from "../../i18n";
import type { TranslationKey } from "../../i18n";
import { Button, Field, PageHeader, Toggle, inputClasses, textareaClasses } from "../ui";

interface Props {
  characterId: string;
  onClose: () => void;
  embedded?: boolean;
}

/** Labels come from `characters.card`: they are the Character Card V2 field names the format defines. */
const TEXT_FIELDS: { key: keyof CharacterCard; labelKey: TranslationKey; rows: number; hintKey?: TranslationKey }[] = [
  { key: "name", labelKey: "characters.card.name", rows: 1 },
  { key: "description", labelKey: "characters.card.description", rows: 5, hintKey: "characters.editor.hint.description" },
  { key: "personality", labelKey: "characters.card.personality", rows: 3, hintKey: "characters.editor.hint.personality" },
  { key: "imageTags", labelKey: "characters.card.imageTagsDanbooru", rows: 3, hintKey: "characters.editor.hint.imageTags" },
  { key: "scenario", labelKey: "characters.card.scenario", rows: 3, hintKey: "characters.editor.hint.scenario" },
  { key: "first_mes", labelKey: "characters.card.firstMessage", rows: 4, hintKey: "characters.editor.hint.firstMessage" },
  { key: "mes_example", labelKey: "characters.card.dialogueExamples", rows: 4, hintKey: "characters.editor.hint.dialogueExamples" },
  { key: "creator_notes", labelKey: "characters.card.creatorNotes", rows: 2, hintKey: "characters.editor.hint.creatorNotes" },
  {
    key: "system_prompt",
    labelKey: "characters.card.systemPrompt",
    rows: 3,
    hintKey: "characters.editor.hint.systemPrompt",
  },
  {
    key: "post_history_instructions",
    labelKey: "characters.card.postHistoryInstructionsJailbreak",
    rows: 3,
    hintKey: "characters.editor.hint.postHistoryInstructions",
  },
  { key: "creator", labelKey: "characters.card.creator", rows: 1 },
  { key: "character_version", labelKey: "characters.card.version", rows: 1 },
];

export function CharacterEditor({ characterId, onClose, embedded = false }: Props) {
  const t = useT();
  const [card, setCard] = useState<CharacterCard | null>(null);
  const [tagsText, setTagsText] = useState("");
  const [imgVersion, setImgVersion] = useState(() => Date.now());
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [generatingGreeting, setGeneratingGreeting] = useState(false);
  const [generatedGreeting, setGeneratedGreeting] = useState<string | null>(null);
  const [greetingError, setGreetingError] = useState("");
  const [translatingGreeting, setTranslatingGreeting] = useState(false);
  const [translatedGreeting, setTranslatedGreeting] = useState<string | null>(null);
  const [translationError, setTranslationError] = useState("");
  const [generatingTags, setGeneratingTags] = useState(false);
  const [generatedTags, setGeneratedTags] = useState<string | null>(null);
  const [tagsError, setTagsError] = useState("");
  const [lorebooks, setLorebooks] = useState<Lorebook[]>([]);

  useEffect(() => {
    Promise.all([charactersApi.getCharacter(characterId), lorebooksApi.listLorebooks()]).then(([c, books]) => {
      setCard(c);
      setTagsText(c.tags.join(", "));
      setLorebooks(books);
    });
  }, [characterId]);

  if (!card) return <p className="text-text-muted">{t("common.state.loading")}</p>;

  function update<K extends keyof CharacterCard>(key: K, value: CharacterCard[K]) {
    setCard((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleGenerateGreeting() {
    setGeneratingGreeting(true);
    setGreetingError("");
    setGeneratedGreeting(null);
    try {
      const { greeting } = await charactersApi.generateGreeting(characterId);
      setGeneratedGreeting(greeting);
    } catch (err) {
      setGreetingError(err instanceof Error ? err.message : t("characters.editor.error.greetingGenerate"));
    } finally {
      setGeneratingGreeting(false);
    }
  }

  function applyGreeting() {
    if (!generatedGreeting) return;
    update("first_mes", generatedGreeting);
    setGeneratedGreeting(null);
  }

  async function handleTranslateGreeting() {
    setTranslatingGreeting(true);
    setTranslationError("");
    setTranslatedGreeting(null);
    try {
      const { greeting } = await charactersApi.translateGreeting(characterId);
      setTranslatedGreeting(greeting);
    } catch (err) {
      setTranslationError(err instanceof Error ? err.message : t("characters.editor.error.greetingTranslate"));
    } finally {
      setTranslatingGreeting(false);
    }
  }

  function applyTranslatedGreeting() {
    if (!translatedGreeting) return;
    update("first_mes", translatedGreeting);
    setTranslatedGreeting(null);
  }

  async function handleGenerateTags() {
    setGeneratingTags(true);
    setTagsError("");
    setGeneratedTags(null);
    try {
      const { imageTags } = await charactersApi.generateImageTags(characterId);
      setGeneratedTags(imageTags);
    } catch (err) {
      setTagsError(err instanceof Error ? err.message : t("characters.editor.error.tagsGenerate"));
    } finally {
      setGeneratingTags(false);
    }
  }

  function applyTags() {
    if (!generatedTags) return;
    update("imageTags", generatedTags);
    setGeneratedTags(null);
  }

  async function handleSave() {
    if (!card) return;
    const tags = tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    await charactersApi.updateCharacter(card.id, { ...card, tags });
    onClose();
  }

  async function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await charactersApi.replaceImage(characterId, file);
    setImgVersion(Date.now());
  }

  return (
    <div>
      {!embedded && (
        <PageHeader
          icon={UserCog}
          title={t("characters.editor.title", { name: card.name })}
          description={t("characters.editor.description")}
        />
      )}

      <div className="mb-6 flex items-center gap-3">
        <img
          src={`${charactersApi.imageUrl(characterId)}?t=${imgVersion}`}
          alt={card.name}
          className="h-24 w-24 rounded-md border border-border object-cover"
        />
        <Button variant="secondary" onClick={() => imageInputRef.current?.click()}>
          <ImageUp size={16} />
          {t("characters.editor.changeImage")}
        </Button>
        <input ref={imageInputRef} type="file" accept="image/png" hidden onChange={handleImageChange} />
      </div>

      <div className="mb-6 rounded-md border border-border bg-bg-elevated p-3">
        <Toggle
          checked={!!card.isWorld}
          onChange={(v) => update("isWorld", v)}
          label={t("characters.editor.worldToggle.label")}
          hint={t("characters.editor.worldToggle.hint")}
        />
      </div>

      <div className="mb-6 rounded-md border border-border bg-bg-elevated p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-text">{t("characters.editor.greeting.label")}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleTranslateGreeting} disabled={translatingGreeting}>
              <Languages size={14} />
              {translatingGreeting ? t("characters.editor.greeting.translating") : t("characters.editor.greeting.translate")}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleGenerateGreeting} disabled={generatingGreeting}>
              <Sparkles size={14} />
              {generatingGreeting ? t("characters.action.generating") : t("characters.editor.greeting.regenerate")}
            </Button>
          </div>
        </div>
        {greetingError && <p className="mt-2 text-xs text-danger">{greetingError}</p>}
        {translationError && <p className="mt-2 text-xs text-danger">{translationError}</p>}
        {generatedGreeting && (
          <div className="mt-2 rounded-md border border-border bg-bg-elevated-2 p-3">
            <p className="mb-2 text-xs text-text-faint">{t("characters.editor.greeting.generatedNotice")}</p>
            <p className="whitespace-pre-wrap text-sm text-text">{generatedGreeting}</p>
            <div className="mt-2 flex gap-2">
              <Button variant="primary" size="sm" onClick={applyGreeting}>
                {t("characters.editor.greeting.use")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setGeneratedGreeting(null)}>
                {t("characters.action.discard")}
              </Button>
            </div>
          </div>
        )}
        {translatedGreeting && (
          <div className="mt-2 rounded-md border border-border bg-bg-elevated-2 p-3">
            <p className="mb-2 text-xs text-text-faint">{t("characters.editor.greeting.translatedNotice")}</p>
            <p className="whitespace-pre-wrap text-sm text-text">{translatedGreeting}</p>
            <div className="mt-2 flex gap-2">
              <Button variant="primary" size="sm" onClick={applyTranslatedGreeting}>
                {t("characters.editor.greeting.useTranslation")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setTranslatedGreeting(null)}>
                {t("characters.action.discard")}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-md border border-border bg-bg-elevated p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text">{t("characters.card.imageTagsDanbooru")}</span>
          <Button variant="secondary" size="sm" onClick={handleGenerateTags} disabled={generatingTags}>
            <Sparkles size={14} />
            {generatingTags ? t("characters.action.generating") : t("characters.editor.imageTags.generate")}
          </Button>
        </div>
        {tagsError && <p className="mt-2 text-xs text-danger">{tagsError}</p>}
        {generatedTags && (
          <div className="mt-2 rounded-md border border-border bg-bg-elevated-2 p-3">
            <p className="mb-2 text-xs text-text-faint">{t("characters.editor.imageTags.generatedNotice")}</p>
            <p className="whitespace-pre-wrap text-sm text-text">{generatedTags}</p>
            <div className="mt-2 flex gap-2">
              <Button variant="primary" size="sm" onClick={applyTags}>
                {t("characters.editor.imageTags.use")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setGeneratedTags(null)}>
                {t("characters.action.discard")}
              </Button>
            </div>
          </div>
        )}
      </div>

      <section className="character-lore-section">
        <div className="character-lore-section__heading">
          <span><BookMarked size={18} /></span>
          <div><h3>{t("characters.editor.knowledge.title")}</h3><p>{t("characters.editor.knowledge.description")}</p></div>
        </div>
        {card.character_book && (
          <div className="character-embedded-lore"><div><strong>{t("characters.editor.knowledge.embeddedTitle")}</strong><small>{t("characters.editor.knowledge.embeddedHint")}</small></div><span>{Object.keys((card.character_book.entries as Record<string, unknown> | undefined) ?? {}).length} {t("lorebooks.shared.entries")}</span></div>
        )}
        <Field label={t("characters.editor.knowledge.libraryLabel")} hint={t("characters.editor.knowledge.libraryHint")}>
          <div className="character-lore-picker">
            {lorebooks.map((book) => {
              const checked = (card.lorebookIds ?? []).includes(book.id);
              return <label key={book.id} className={checked ? "is-selected" : ""}><input type="checkbox" checked={checked} onChange={() => update("lorebookIds", checked ? (card.lorebookIds ?? []).filter((id) => id !== book.id) : [...(card.lorebookIds ?? []), book.id])} /><BookMarked size={15} /><span><strong>{book.name}</strong><small>{Object.keys(book.entries).length} {t("lorebooks.shared.entries")}</small></span></label>;
            })}
            {!lorebooks.length && <p className="character-lore-picker__empty">{t("characters.editor.knowledge.empty")}</p>}
          </div>
        </Field>
      </section>

      <div className="flex flex-col gap-4">
        {TEXT_FIELDS.map(({ key, labelKey, rows, hintKey }) => (
          <Field key={key} label={t(labelKey)} hint={hintKey ? t(hintKey) : undefined}>
            {rows === 1 ? (
              <input
                value={card[key] as string}
                onChange={(e) => update(key, e.target.value as CharacterCard[typeof key])}
                className={inputClasses}
              />
            ) : (
              <textarea
                value={card[key] as string}
                onChange={(e) => update(key, e.target.value as CharacterCard[typeof key])}
                rows={rows}
                className={textareaClasses}
              />
            )}
          </Field>
        ))}

        <Field label={t("characters.card.tags")} hint={t("characters.editor.tagsHint")}>
          <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} className={inputClasses} />
        </Field>
      </div>

      <div className="mt-6 flex gap-2">
        <Button variant="primary" onClick={handleSave}>
          {t("common.actions.save")}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {t("common.actions.cancel")}
        </Button>
      </div>
    </div>
  );
}
