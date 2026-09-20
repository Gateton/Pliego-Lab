import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Download, ExternalLink, KeyRound, PartyPopper, Upload, Wand2 } from "lucide-react";
import type { ModalId } from "../../App";
import type { AppThemeId } from "../../lib/themes";
import { LOCALES, LOCALE_NATIVE_NAMES, setLocale, useLocale, useT } from "../../i18n";
import type { Locale, TranslationKey } from "../../i18n";
import { useProviders } from "../../hooks/useProviders";
import { useProviderModels } from "../../hooks/useProviderModels";
import { usePersonas } from "../../hooks/usePersonas";
import * as personasApi from "../../api/personas";
import { useSettings } from "../../hooks/useSettings";
import { useSamplingPresets } from "../../hooks/useSamplingPresets";
import { useCharacters } from "../../hooks/useCharacters";
import * as charactersApi from "../../api/characters";
import { Alert, Button, Field, inputClasses, textareaClasses } from "../ui";
import { ProviderConnectionPanel } from "../settings/ProviderConnectionPanel";
import { ThemeGrid } from "../settings/ThemeGrid";
import { ModelSelect } from "../settings/ModelSelect";
import { SillyTavernImportPanel } from "../settings/SillyTavernImportPanel";
import { FEATURES, PROVIDER_KEY_URLS } from "./features";
import { getUserCharacters } from "../../lib/characterVisibility";

interface Props {
  theme: AppThemeId;
  onThemeChange: (theme: AppThemeId) => void;
  /** Opens a config overlay and closes the wizard (the user continues there). */
  onOpenModal: (modal: Exclude<ModalId, null>) => void;
  /** Leaves the wizard. `startTour` chains the interface guide right after. */
  onFinish: (opts: { startTour: boolean }) => void;
}

const STEP_IDS = ["language", "sillyTavern", "welcome", "provider", "model", "theme", "persona", "character", "done"] as const;
type StepId = (typeof STEP_IDS)[number];

const STEP_LABELS: Record<StepId, TranslationKey> = {
  language: "onboarding.wizard.stepLabels.language",
  sillyTavern: "onboarding.wizard.stepLabels.sillyTavern",
  welcome: "onboarding.wizard.stepLabels.welcome",
  provider: "onboarding.wizard.stepLabels.provider",
  model: "onboarding.wizard.stepLabels.model",
  theme: "onboarding.wizard.stepLabels.theme",
  persona: "onboarding.wizard.stepLabels.persona",
  character: "onboarding.wizard.stepLabels.character",
  done: "onboarding.wizard.stepLabels.done",
};

const LANGUAGE_OPTION_KEYS: Record<Locale, TranslationKey> = {
  es: "onboarding.wizard.language.option.es",
  en: "onboarding.wizard.language.option.en",
};

/**
 * First-run setup. Shown once, on an installation that cannot generate anything yet, and reachable
 * later from Settings. Every step can be skipped: the wizard explains and configures, it never
 * blocks the app (a chat without a key fails with the backend's own error, as before).
 */
export function FirstRunWizard({ theme, onThemeChange, onOpenModal, onFinish }: Props) {
  const t = useT();
  const locale = useLocale();
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEP_IDS[stepIndex];
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Provider step
  const { active, loading: providersLoading, refresh: refreshProviders } = useProviders();
  const { models } = useProviderModels(active?.id ?? null, active?.baseUrl);
  // Model step
  const { presets, create: createPreset, update: updatePreset, refresh: refreshPresets } = useSamplingPresets();
  const { settings, update: updateSettings } = useSettings();
  // Persona step
  const { personas, refresh: refreshPersonas } = usePersonas();
  const [personaName, setPersonaName] = useState("");
  const [personaDescription, setPersonaDescription] = useState("");
  const [savingPersona, setSavingPersona] = useState(false);
  const [personaSaved, setPersonaSaved] = useState(false);
  // Holds the picked model while the first preset is being created (the preset list has no entry
  // to read it from yet).
  const [activeModelDraft, setActiveModelDraft] = useState("");
  const [sillyTavernImportOpen, setSillyTavernImportOpen] = useState(false);
  // Character step
  const { characters, refresh: refreshCharacters } = useCharacters();
  const userCharacters = getUserCharacters(characters);
  const [importedName, setImportedName] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const activePreset = presets.find((p) => p.id === settings?.activeSamplingPresetId) ?? presets[0] ?? null;
  const keyMissing = !!active && active.requiresApiKey && !active.hasKey;
  const keyUrl = active ? PROVIDER_KEY_URLS[active.id] : undefined;

  useEffect(() => {
    headingRef.current?.focus();
  }, [stepIndex]);

  // Re-read the provider list on every step change: the embedded panel writes through its own hook
  // instance, so this one (the one that decides whether the install is usable yet) has to catch up.
  useEffect(() => {
    void refreshProviders();
  }, [stepIndex, refreshProviders]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onFinish({ startTour: false });
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onFinish]);

  function go(delta: number) {
    setStepIndex((current) => Math.min(Math.max(current + delta, 0), STEP_IDS.length - 1));
  }

  async function savePersona() {
    if (!personaName.trim()) return;
    setSavingPersona(true);
    try {
      const created = await personasApi.createPersona({ name: personaName.trim(), description: personaDescription.trim() });
      await refreshPersonas();
      // Leaving it as the default persona means the tour and the first chat already use it.
      if (settings) await updateSettings({ ...settings, defaultPersonaId: created.id });
      setPersonaName("");
      setPersonaDescription("");
      setPersonaSaved(true);
    } finally {
      setSavingPersona(false);
    }
  }

  /**
   * The model lives in the active preset. A fresh installation has none yet (the code-level
   * fallback drives generation), so choosing a model here creates and activates the first one —
   * otherwise the choice would look saved and then be ignored.
   */
  async function chooseModel(model: string) {
    const value = model.trim();
    if (activePreset) {
      const { id: _id, ...fields } = activePreset;
      await updatePreset(activePreset.id, { ...fields, model: value || undefined });
      return;
    }
    const created = await createPreset({
      name: t("onboarding.wizard.defaultPresetName"),
      model: value || undefined,
      maxContextTokens: 8000,
    });
    await refreshPresets();
    if (settings) await updateSettings({ ...settings, activeSamplingPresetId: created.id });
  }

  async function importDemoCharacter() {
    setImporting(true);
    setImportError(null);
    try {
      const response = await fetch("/demo-character.json");
      if (!response.ok) throw new Error(t("onboarding.wizard.errors.demoCardRead"));
      const blob = await response.blob();
      const file = new File([blob], "vera.json", { type: "application/json" });
      const card = await charactersApi.importJson(file);
      setImportedName(card.name);
      await refreshCharacters();
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : t("onboarding.wizard.errors.demoCardImport"),
      );
    } finally {
      setImporting(false);
    }
  }

  async function importFromFile(file: File) {
    setImporting(true);
    setImportError(null);
    try {
      const card = file.type === "image/png" || file.name.toLowerCase().endsWith(".png")
        ? await charactersApi.importPng(file)
        : await charactersApi.importJson(file);
      setImportedName(card.name);
      await refreshCharacters();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : t("onboarding.wizard.errors.cardImport"));
    } finally {
      setImporting(false);
    }
  }

  function openSillyTavernImport() {
    setSillyTavernImportOpen(true);
    setStepIndex(STEP_IDS.indexOf("sillyTavern"));
  }

  /** Opens a full configuration overlay for settings that are not part of the setup flow. */
  function leaveFor(modal: Exclude<ModalId, null>) {
    onOpenModal(modal);
  }

  const isLast = step === "done";

  return (
    <div className="sg-onboarding fixed inset-0 z-[60] flex bg-bg" role="dialog" aria-modal="true" aria-label={t("onboarding.initialSetup")}>
      <aside className="sg-onboarding__rail">
        <div className="sg-onboarding__brand">
          <img src="/logo.png" alt="" className="sg-onboarding__logo" />
          <div>
            <strong>{t("common.appName")}</strong>
            <span>{t("onboarding.wizard.brandTagline")}</span>
          </div>
        </div>
        <ol className="sg-onboarding__steps">
          {STEP_IDS.map((id, index) => {
            const done = index < stepIndex;
            const current = index === stepIndex;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setStepIndex(index)}
                  className={`sg-onboarding__step ${current ? "is-current" : ""} ${done ? "is-done" : ""}`}
                >
                  <span className="sg-onboarding__step-mark">{done ? <Check size={13} strokeWidth={3} /> : index + 1}</span>
                  {t(STEP_LABELS[id])}
                </button>
              </li>
            );
          })}
        </ol>
        <p className="sg-onboarding__rail-note">{t("onboarding.wizard.railNote")}</p>
      </aside>

      <section className="sg-onboarding__main">
        <div className="sg-onboarding__content">
          <span className="sg-onboarding__kicker">
            {t("onboarding.progress", { current: stepIndex + 1, total: STEP_IDS.length })}
          </span>

          {step === "language" && (
            <>
              <h2 ref={headingRef} tabIndex={-1} className="sg-onboarding__title">
                {t("onboarding.wizard.language.title")}
              </h2>
              <p className="sg-onboarding__lead">{t("onboarding.wizard.language.lead")}</p>
              <div className="sg-onboarding__choices max-w-xl" role="radiogroup" aria-label={t("onboarding.wizard.language.groupLabel")}>
                {LOCALES.map((id) => {
                  const selected = id === locale;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`sg-onboarding__choice ${selected ? "is-selected" : ""}`}
                      onClick={() => setLocale(id)}
                    >
                      <Check size={18} className={selected ? "text-accent" : "text-transparent"} />
                      <span>
                        <strong>{LOCALE_NATIVE_NAMES[id]}</strong>
                        <span>{t(LANGUAGE_OPTION_KEYS[id])}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === "sillyTavern" && (
            <>
              <h2 ref={headingRef} tabIndex={-1} className="sg-onboarding__title">
                {t("onboarding.wizard.sillyTavern.title")}
              </h2>
              <p className="sg-onboarding__lead">{t("onboarding.wizard.sillyTavern.lead")}</p>
              {sillyTavernImportOpen ? (
                <SillyTavernImportPanel embedded />
              ) : (
                <div className="sg-onboarding__choices max-w-2xl">
                  <button type="button" className="sg-onboarding__choice sg-onboarding__choice--centered" onClick={openSillyTavernImport}>
                    <Download size={18} />
                    <strong>{t("onboarding.wizard.sillyTavern.import.title")}</strong>
                    <span>{t("onboarding.wizard.sillyTavern.import.body")}</span>
                  </button>
                  <button type="button" className="sg-onboarding__choice sg-onboarding__choice--centered" onClick={() => go(1)}>
                    <ArrowRight size={18} />
                    <strong>{t("onboarding.wizard.sillyTavern.skip.title")}</strong>
                    <span>{t("onboarding.wizard.sillyTavern.skip.body")}</span>
                  </button>
                </div>
              )}
            </>
          )}

          {step === "welcome" && (
            <>
              <h2 ref={headingRef} tabIndex={-1} className="sg-onboarding__title">
                {t("onboarding.wizard.welcome.title")}
              </h2>
              <p className="sg-onboarding__lead">{t("onboarding.wizard.welcome.lead")}</p>
              <h3 className="sg-onboarding__subtitle">{t("onboarding.wizard.welcome.featuresTitle")}</h3>
              <ul className="sg-onboarding__features">
                {FEATURES.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <li key={feature.id} className="sg-onboarding__feature">
                      <span className="sg-onboarding__feature-icon">
                        <Icon size={15} />
                      </span>
                      <div>
                        <strong>{t(feature.nameKey)}</strong>
                        <p>{t(feature.blurbKey)}</p>
                        {feature.requiresKey && <p className="sg-onboarding__feature-note">{t(feature.requiresKey)}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {step === "provider" && (
            <>
              <h2 ref={headingRef} tabIndex={-1} className="sg-onboarding__title">
                {t("onboarding.wizard.provider.title")}
              </h2>
              <p className="sg-onboarding__lead">{t("onboarding.wizard.provider.lead")}</p>
              {providersLoading ? (
                <p className="text-text-muted">{t("onboarding.wizard.providersLoading")}</p>
              ) : (
                <>
                  <ProviderConnectionPanel embedded />
                  <div className="sg-onboarding__hint">
                    <KeyRound size={14} />
                    <div>
                      <p>{t("onboarding.wizard.provider.hint")}</p>
                      {keyUrl && (
                        <a href={keyUrl} target="_blank" rel="noreferrer" className="sg-onboarding__link">
                          {t("onboarding.wizard.provider.keyLink", { provider: active?.label ?? "" })}
                          <ExternalLink size={12} />
                        </a>
                      )}
                      {!keyUrl && active && !active.requiresApiKey && (
                        <p>{t("onboarding.wizard.provider.noKeyNeeded", { provider: active.label })}</p>
                      )}
                    </div>
                  </div>
                  {!keyMissing && (
                    <Alert kind="success">
                      {t("onboarding.wizard.provider.keyReady", { provider: active?.label ?? "" })}
                    </Alert>
                  )}
                </>
              )}
            </>
          )}

          {step === "model" && (
            <>
              <h2 ref={headingRef} tabIndex={-1} className="sg-onboarding__title">
                {t("onboarding.wizard.model.title")}
              </h2>
              <p className="sg-onboarding__lead">{t("onboarding.wizard.model.lead")}</p>
              <div className="max-w-xl">
                <Field
                  label={
                    activePreset
                      ? t("onboarding.wizard.model.fieldWithPreset", { preset: activePreset.name })
                      : t("onboarding.wizard.model.field")
                  }
                  hint={t("onboarding.wizard.model.hint")}
                >
                  <ModelSelect
                    models={models}
                    value={activePreset?.model ?? activeModelDraft}
                    onChange={(model) => {
                      setActiveModelDraft(model.trim());
                      void chooseModel(model);
                    }}
                    placeholder={active?.defaultModel || t("onboarding.wizard.model.placeholder")}
                  />
                </Field>
                {!activePreset && (
                  <p className="mt-3 text-xs text-text-faint">{t("onboarding.wizard.model.noPresets")}</p>
                )}
                {models.length === 0 && (
                  <p className="mt-3 text-xs text-text-faint">{t("onboarding.wizard.model.noModelList")}</p>
                )}
              </div>
            </>
          )}

          {step === "theme" && (
            <>
              <h2 ref={headingRef} tabIndex={-1} className="sg-onboarding__title">
                {t("onboarding.wizard.theme.title")}
              </h2>
              <p className="sg-onboarding__lead">{t("onboarding.wizard.theme.lead")}</p>
              <ThemeGrid value={theme} onChange={onThemeChange} className="mt-2 max-w-3xl" />
            </>
          )}

          {step === "persona" && (
            <>
              <h2 ref={headingRef} tabIndex={-1} className="sg-onboarding__title">
                {t("onboarding.wizard.persona.title")}
              </h2>
              <p className="sg-onboarding__lead">
                {t("onboarding.wizard.persona.leadPrefix")} {"{{user}}"} {t("onboarding.wizard.persona.leadSuffix")}
              </p>
              {personas.length > 0 && !personaSaved && (
                <Alert kind="info">
                  {t("onboarding.wizard.persona.existing", { count: personas.length })}
                </Alert>
              )}
              {personaSaved && <Alert kind="success">{t("onboarding.wizard.persona.saved")}</Alert>}
              <div className="max-w-md">
                <Field label={t("onboarding.wizard.persona.name")} className="mb-3">
                  <input
                    value={personaName}
                    onChange={(event) => setPersonaName(event.target.value)}
                    placeholder={t("onboarding.wizard.persona.namePlaceholder")}
                    className={inputClasses}
                  />
                </Field>
                <Field
                  label={t("onboarding.wizard.persona.description")}
                  hint={t("onboarding.wizard.persona.descriptionHint")}
                  className="mb-3"
                >
                  <textarea
                    value={personaDescription}
                    onChange={(event) => setPersonaDescription(event.target.value)}
                    rows={4}
                    placeholder={t("onboarding.wizard.persona.descriptionPlaceholder")}
                    className={textareaClasses}
                  />
                </Field>
                <Button onClick={() => void savePersona()} disabled={savingPersona || !personaName.trim()}>
                  {savingPersona ? t("onboarding.wizard.persona.saving") : t("onboarding.wizard.persona.save")}
                </Button>
              </div>
            </>
          )}

          {step === "character" && (
            <>
              <h2 ref={headingRef} tabIndex={-1} className="sg-onboarding__title">
                {t("onboarding.wizard.character.title")}
              </h2>
              <p className="sg-onboarding__lead">{t("onboarding.wizard.character.lead")}</p>
              <div className="sg-onboarding__choices">
                <button type="button" className="sg-onboarding__choice sg-onboarding__choice--centered" onClick={() => void importDemoCharacter()} disabled={importing}>
                  <PartyPopper size={18} />
                  <strong>{t("onboarding.wizard.character.demo.title")}</strong>
                  <span>{t("onboarding.wizard.character.demo.body")}</span>
                </button>
                <button type="button" className="sg-onboarding__choice sg-onboarding__choice--centered" onClick={() => fileRef.current?.click()} disabled={importing}>
                  <Upload size={18} />
                  <strong>{t("onboarding.wizard.character.importCard.title")}</strong>
                  <span>{t("onboarding.wizard.character.importCard.body")}</span>
                </button>
                <button type="button" className="sg-onboarding__choice sg-onboarding__choice--centered" onClick={() => leaveFor("character-creator")}>
                  <Wand2 size={18} />
                  <strong>{t("onboarding.wizard.character.create.title")}</strong>
                  <span>{t("onboarding.wizard.character.create.body")}</span>
                </button>
                <button type="button" className="sg-onboarding__choice sg-onboarding__choice--centered" onClick={openSillyTavernImport}>
                  <Download size={18} />
                  <strong>{t("onboarding.wizard.character.fromSillyTavern.title")}</strong>
                  <span>{t("onboarding.wizard.character.fromSillyTavern.body")}</span>
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,application/json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void importFromFile(file);
                }}
              />
              {importing && <p className="mt-4 text-sm text-text-muted">{t("onboarding.wizard.character.importing")}</p>}
              {importError && (
                <div className="mt-4 max-w-xl">
                  <Alert kind="error">{importError}</Alert>
                </div>
              )}
              {(importedName || userCharacters.length > 0) && (
                <div className="mt-4 max-w-xl">
                  <Alert kind="success">
                    {importedName
                      ? t("onboarding.wizard.character.imported", { name: importedName })
                      : t("onboarding.wizard.character.alreadyHave")}
                  </Alert>
                </div>
              )}
            </>
          )}

          {step === "done" && (
            <>
              <h2 ref={headingRef} tabIndex={-1} className="sg-onboarding__title">
                {t("onboarding.wizard.done.title")}
              </h2>
              <p className="sg-onboarding__lead">{t("onboarding.wizard.done.lead")}</p>
              <ul className="sg-onboarding__summary">
                <li>
                  <span>{t("onboarding.wizard.done.provider")}</span>
                  <strong>
                    {active?.label ?? "—"}
                    {active?.hasKey ? "" : t("onboarding.wizard.done.providerNoKey")}
                  </strong>
                </li>
                <li>
                  <span>{t("onboarding.wizard.done.model")}</span>
                  <strong>{activePreset?.model ?? active?.defaultModel ?? "—"}</strong>
                </li>
                <li>
                  <span>{t("onboarding.wizard.done.persona")}</span>
                  <strong>
                    {personas.length > 0 ? personas[personas.length - 1].name : t("onboarding.wizard.done.personaNone")}
                  </strong>
                </li>
                <li>
                  <span>{t("onboarding.wizard.done.characters")}</span>
                  <strong>
                    {userCharacters.length > 0
                      ? t("onboarding.wizard.done.charactersCount", { count: userCharacters.length })
                      : t("onboarding.wizard.done.charactersNone")}
                  </strong>
                </li>
              </ul>
              <div className="sg-onboarding__done-actions">
                <Button onClick={() => onFinish({ startTour: true })}>
                  <ArrowRight size={15} />
                  {t("onboarding.wizard.done.startTour")}
                </Button>
                <Button variant="secondary" onClick={() => onFinish({ startTour: false })}>
                  {t("onboarding.wizard.done.explore")}
                </Button>
              </div>
            </>
          )}
        </div>

        <footer className="sg-onboarding__footer">
          <button type="button" className="sg-onboarding__skip" onClick={() => onFinish({ startTour: false })}>
            {t("onboarding.wizard.skip")}
          </button>
          <div className="sg-onboarding__nav">
            <Button variant="ghost" onClick={() => go(-1)} disabled={stepIndex === 0}>
              <ArrowLeft size={15} />
              {t("onboarding.nav.previous")}
            </Button>
            {isLast ? (
              <Button onClick={() => onFinish({ startTour: true })}>
                {t("onboarding.wizard.finishWithTour")}
                <ArrowRight size={15} />
              </Button>
            ) : (
              <Button onClick={() => go(1)}>
                {t("onboarding.nav.next")}
                <ArrowRight size={15} />
              </Button>
            )}
          </div>
        </footer>
      </section>

    </div>
  );
}
