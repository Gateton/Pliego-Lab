import { useState } from "react";
import { Blocks, Copy, Trash2 } from "lucide-react";
import { useAddonsSettings } from "../../hooks/useAddonsSettings";
import { useSettings } from "../../hooks/useSettings";
import type { Addon, AddonsSettings } from "../../types/addons";
import { Button, PageHeader, Toggle, inputClasses, textareaClasses } from "../ui";
import { LibraryEditor } from "./LibraryEditor";
import { useT } from "../../i18n";

/** Reglas — optional rule packs appended to the prompt, plus how dialogue is rendered. */
export function RulesPanel() {
  const t = useT();
  const { settings, update } = useAddonsSettings();
  const { settings: appSettings, update: updateApp } = useSettings();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!settings || !appSettings) return <p className="text-text-muted">{t("common.state.loading")}</p>;

  const addons = settings.addons ?? [];
  const activeCount = settings.activeAddonIds.length;

  function persist(next: AddonsSettings) {
    update(next);
  }

  function isActive(addon: Addon) {
    return settings!.activeAddonIds.includes(addon.id);
  }

  function toggleAddon(id: string) {
    const addon = addons.find((a) => a.id === id);
    if (!addon) return;
    if (isActive(addon)) {
      persist({ ...settings!, activeAddonIds: settings!.activeAddonIds.filter((i) => i !== id) });
      return;
    }
    let nextIds = settings!.activeAddonIds;
    if (addon.exclusive) {
      const rivals = addons.filter((o) => o.id !== id && o.exclusive === addon.exclusive).map((o) => o.id);
      nextIds = nextIds.filter((i) => !rivals.includes(i));
    }
    persist({ ...settings!, activeAddonIds: [...nextIds, id] });
  }

  function createAddon() {
    const addon: Addon = { id: crypto.randomUUID(), name: t("estudio.rules.newRule"), trigger: "", content: "" };
    persist({ ...settings!, addons: [...addons, addon] });
    setSelectedId(addon.id);
  }

  function updateAddon(id: string, patch: Partial<Addon>) {
    persist({ ...settings!, addons: addons.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  }

  function duplicateAddon(addon: Addon) {
    const copy: Addon = { ...addon, id: crypto.randomUUID(), name: t("estudio.rules.copyName", { name: addon.name }), builtin: false };
    persist({ ...settings!, addons: [...addons, copy] });
    setSelectedId(copy.id);
  }

  function deleteAddon(id: string) {
    persist({
      ...settings!,
      addons: addons.filter((a) => a.id !== id),
      activeAddonIds: settings!.activeAddonIds.filter((i) => i !== id),
    });
    if (selectedId === id) setSelectedId(null);
  }

  return (
    <div>
      <PageHeader
        icon={Blocks}
        title={t("estudio.rules.title")}
        description={t("estudio.rules.description")}
        actions={
          <span className="text-xs text-text-faint">
            {settings.enabled ? t("estudio.rules.activeCount", { count: activeCount }) : t("estudio.rules.off")}
          </span>
        }
      />

      <div className="mb-5 rounded-lg border border-border bg-bg-elevated p-4">
        <Toggle
          checked={settings.enabled}
          onChange={(enabled) => persist({ ...settings!, enabled })}
          label={t("estudio.rules.enabled")}
          hint={t("estudio.rules.enabledHint")}
        />
        <div className="mt-3 border-t border-border pt-3">
          <Toggle
            checked={appSettings.coloredDialogue}
            onChange={(v) => updateApp({ ...appSettings, coloredDialogue: v })}
            label={t("estudio.rules.coloredDialogue")}
            hint={t("estudio.rules.coloredDialogueHint")}
          />
        </div>
      </div>

      <LibraryEditor
        items={addons}
        selectedId={selectedId}
        onSelect={setSelectedId}
        isActive={isActive}
        nameOf={(a) => a.name}
        onCreate={createAddon}
        createLabel={t("estudio.rules.newRule")}
        emptyState={{
          title: t("estudio.rules.emptyTitle"),
          body: t("estudio.rules.emptyBody"),
        }}
        itemAction={(addon) => (
          <label
            className="mr-1.5 flex shrink-0 cursor-pointer items-center"
            title={isActive(addon) ? t("estudio.rules.deactivate") : t("estudio.rules.activate")}
          >
            <input type="checkbox" checked={isActive(addon)} onChange={() => toggleAddon(addon.id)} className="accent-accent" />
          </label>
        )}
        editor={(addon) => (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={addon.name}
                onChange={(e) => updateAddon(addon.id, { name: e.target.value })}
                disabled={addon.builtin}
                className="min-w-0 flex-1 border-0 bg-transparent font-display text-lg font-semibold text-text outline-none disabled:opacity-80"
                placeholder={t("estudio.rules.name")}
              />
              <Button variant={isActive(addon) ? "primary" : "secondary"} size="sm" onClick={() => toggleAddon(addon.id)}>
                {isActive(addon) ? t("estudio.rules.active") : t("estudio.rules.activate")}
              </Button>
              <button
                onClick={() => duplicateAddon(addon)}
                title={t("estudio.rules.duplicate")}
                aria-label={t("estudio.rules.duplicateRule")}
                className="cursor-pointer rounded-md p-1.5 text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
              >
                <Copy size={15} />
              </button>
              <button
                onClick={() => deleteAddon(addon.id)}
                title={t("estudio.rules.delete")}
                aria-label={t("estudio.rules.deleteRule")}
                className="cursor-pointer rounded-md p-1.5 text-text-muted transition-colors hover:bg-danger/15 hover:text-danger"
              >
                <Trash2 size={15} />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <p className="max-w-xl text-sm leading-relaxed text-text-muted">{addon.description ?? t("estudio.rules.customDescription")}</p>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint">{t("estudio.rules.trigger")}</span>
                <input
                  value={addon.trigger}
                  onChange={(e) => updateAddon(addon.id, { trigger: e.target.value })}
                  className={`${inputClasses} w-44!`}
                  placeholder="[[dice]]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint">{t("estudio.rules.exclusiveGroup")}</span>
                <input
                  value={addon.exclusive ?? ""}
                  onChange={(e) => updateAddon(addon.id, { exclusive: e.target.value || undefined })}
                  className={`${inputClasses} w-32!`}
                  placeholder="dice"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint">{t("estudio.rules.rolls")}</span>
                <input
                  type="number"
                  min={0}
                  value={addon.rolls ?? 0}
                  onChange={(e) => updateAddon(addon.id, { rolls: Number(e.target.value) || undefined })}
                  className={`${inputClasses} w-24!`}
                />
              </label>
            </div>

              <label className="mt-3 block">
                <span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">{t("estudio.rules.content")}</span>
                <textarea
                  rows={14}
                  value={addon.content}
                  disabled={addon.builtin}
                  onChange={(e) => updateAddon(addon.id, { content: e.target.value })}
                  className={`${textareaClasses} font-mono text-xs disabled:cursor-not-allowed disabled:opacity-50`}
                  placeholder={t("estudio.rules.contentPlaceholder")}
                />
              </label>
          </>
        )}
      />
    </div>
  );
}
