import { Sparkles } from "lucide-react";
import { useT } from "../../i18n";
import { useRecastSettings } from "../../hooks/useRecastSettings";
import { useRecastPresets } from "../../hooks/useRecastPresets";
import type { RecastSettings as Settings } from "../../types/recast";
import { Alert, Field, PageHeader, Toggle, inputClasses } from "../ui";

export function RecastSettings() {
  const t = useT();
  const { settings, update } = useRecastSettings();
  const { presets } = useRecastPresets();

  if (!settings) return <p className="text-text-muted">{t("common.state.loading")}</p>;
  const s = settings;

  const activePreset = presets.find((p) => p.id === s.activePresetId);
  const activePresetMissing = s.activePresetId != null && !activePreset;
  const activePasses = activePreset ? activePreset.passes.filter((p) => p.enabled).length : 0;

  // Everything auto-saves immediately (no "Guardar" button) — matches the original Recast.
  function persist(patch: Partial<Settings>) {
    void update({ ...s, ...patch });
  }

  return (
    <div>
      <PageHeader
        icon={Sparkles}
        title={t("settings.recast.title")}
        description={t("settings.recast.description")}
      />

      {activePresetMissing && (
        <div className="mb-4">
          <Alert kind="error">
            {t("settings.recast.presetMissing")}
          </Alert>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Toggle
          checked={settings.enabled}
          onChange={(enabled) => persist({ enabled })}
          label={t("settings.shared.enabled")}
          hint={settings.enabled && !activePreset ? t("settings.recast.enabledNoPreset") : t("settings.recast.enabledHint")}
        />

        <Toggle
          checked={settings.autoRun}
          onChange={(autoRun) => persist({ autoRun })}
          label={t("settings.recast.autoRun")}
          hint={t("settings.recast.autoRunHint")}
        />

        <Field
          label={t("settings.recast.activePreset")}
          hint={
            activePreset
              ? t("settings.recast.activePresetHint", { active: activePasses, total: activePreset.passes.length, name: activePreset.name })
              : t("settings.recast.activePresetEmpty")
          }
          className="max-w-sm"
        >
          <select value={settings.activePresetId ?? ""} onChange={(e) => persist({ activePresetId: e.target.value || null })} className={inputClasses}>
            <option value="">{t("settings.shared.none")}</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label={t("settings.recast.minChars")}
          hint={t("settings.recast.minCharsHint")}
          className="max-w-xs"
        >
          <input type="number" value={settings.minChars} onChange={(e) => persist({ minChars: Number(e.target.value) })} className={inputClasses} />
        </Field>

        <Toggle
          checked={settings.sceneContextAsRoles}
          onChange={(sceneContextAsRoles) => persist({ sceneContextAsRoles })}
          label={t("settings.recast.sceneContextAsRoles")}
          hint={t("settings.recast.sceneContextAsRolesHint")}
        />
      </div>
    </div>
  );
}
