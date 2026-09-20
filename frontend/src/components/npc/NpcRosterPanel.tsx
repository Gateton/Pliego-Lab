import { useEffect, useState } from "react";
import { ImagePlus, Loader2, Minimize2, RefreshCw, ScanSearch, Sparkles, Star, Trash2, UserCircle } from "lucide-react";
import * as npcTrackerApi from "../../api/npcTracker";
import * as favoriteNpcsApi from "../../api/favoriteNpcs";
import { usePersonas } from "../../hooks/usePersonas";
import { useT } from "../../i18n";
import { findNpcByName, getNpcAvatarUrl } from "../../lib/npcTracker";
import type { Chat } from "../../types/chat";
import type { NpcRecord, NpcTrackerSettings } from "../../types/npcTracker";
import type { Persona } from "../../types/persona";
import { Button } from "../ui";
import { DossierFieldInput } from "./DossierFieldInput";

interface Props {
  chat: Chat | null;
  onScan: () => void;
  scanning?: boolean;
  onEvolve?: () => Promise<number>;
  evolving?: boolean;
  onUpdateNpcs: (npcs: NpcRecord[]) => void;
  preselectName?: string;
}

export function NpcRosterPanel({ chat, onScan, scanning, onEvolve, evolving, onUpdateNpcs, preselectName }: Props) {
  const t = useT();
  const [settings, setSettings] = useState<NpcTrackerSettings | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => (preselectName ? (findNpcByName(chat?.npcs ?? [], preselectName)?.id ?? null) : null),
  );
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [favorites, setFavorites] = useState<NpcRecord[]>([]);
  const [favoritingId, setFavoritingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [consolidatingKey, setConsolidatingKey] = useState<string | null>(null);
  const [evolveResult, setEvolveResult] = useState<string | null>(null);
  const { personas } = usePersonas();

  async function handleEvolve() {
    if (!onEvolve) return;
    setError("");
    setEvolveResult(null);
    try {
      const changed = await onEvolve();
      setEvolveResult(changed > 0 ? t("npc.roster.evolveResult", { count: changed }) : t("npc.roster.evolveNoChanges"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("npc.roster.error.evolve"));
    }
  }

  useEffect(() => {
    npcTrackerApi.getNpcTrackerSettings().then(setSettings);
    favoriteNpcsApi.getFavoriteNpcs().then(setFavorites).catch(() => setFavorites([]));
  }, []);

  const npcs = chat?.npcs ?? [];
  const fields = settings?.fields ?? [];
  const enabled = settings?.enabled ?? false;
  const selected = npcs.find((n) => n.id === selectedId) ?? npcs[0] ?? null;

  function updateNpc(id: string, patch: Partial<NpcRecord>) {
    onUpdateNpcs(npcs.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  function deleteNpc(id: string) {
    onUpdateNpcs(npcs.filter((n) => n.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  async function generatePortrait(npc: NpcRecord) {
    const imageTags = npc.values["imageTags"]?.trim();
    if (!imageTags) return;
    setGeneratingId(npc.id);
    setError("");
    try {
      const { pfp } = await npcTrackerApi.generateNpcPortrait(imageTags);
      updateNpc(npc.id, { pfp });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("npc.roster.error.portrait"));
    } finally {
      setGeneratingId(null);
    }
  }

  async function favoriteNpc(npc: NpcRecord) {
    setFavoritingId(npc.id);
    setError("");
    try {
      const favorite = await favoriteNpcsApi.addFavoriteNpc({ name: npc.name, values: npc.values, ...(npc.pfp ? { pfp: npc.pfp } : {}) });
      setFavorites((prev) => [...prev, favorite]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("npc.roster.error.favorite"));
    } finally {
      setFavoritingId(null);
    }
  }

  // Full rewrite from the whole conversation — only produces something real in the chat where
  // this NPC actually has content (its "chat de nacimiento"); a Favoritos-imported copy in an
  // unrelated chat will just come back mostly empty, since there's nothing here to read from.
  async function regenerateNpc(npc: NpcRecord) {
    if (!chat) return;
    setRegeneratingId(npc.id);
    setError("");
    try {
      const { npc: updated } = await npcTrackerApi.regenerateNpc(chat.id, npc.id, npc.name);
      updateNpc(npc.id, { values: updated.values });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("npc.roster.error.regenerate"));
    } finally {
      setRegeneratingId(null);
    }
  }

  // Manual trigger for the same compaction pass the automatic threshold uses — lets the user
  // force it before the threshold is reached, or when the automatic trigger is disabled.
  async function consolidateField(npc: NpcRecord, fieldKey: string) {
    if (!chat) return;
    const requestKey = `${npc.id}:${fieldKey}`;
    setConsolidatingKey(requestKey);
    setError("");
    try {
      const { npc: updated } = await npcTrackerApi.consolidateNpcField(chat.id, npc.id, fieldKey);
      updateNpc(npc.id, { values: updated.values });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("npc.roster.error.consolidate"));
    } finally {
      setConsolidatingKey(null);
    }
  }

  function importFavorite(favorite: NpcRecord) {
    // A fresh id/copy — editing it in this chat never touches the favorite or other chats
    // that already imported it.
    onUpdateNpcs([...npcs, { ...favorite, id: crypto.randomUUID(), values: { ...favorite.values } }]);
  }

  function importPersona(persona: Persona) {
    // Same dossier shape as NpcRecord.values by design — a straight copy, no field remapping.
    // A fresh id/copy, same as Favoritos: editing it here never touches the persona itself.
    onUpdateNpcs([
      ...npcs,
      {
        id: crypto.randomUUID(),
        name: persona.name,
        values: { ...(persona.values ?? {}) },
        ...(persona.avatar ? { pfp: persona.avatar } : {}),
      },
    ]);
  }

  async function removeFavorite(id: string) {
    setError("");
    try {
      await favoriteNpcsApi.removeFavoriteNpc(id);
      setFavorites((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("npc.roster.error.removeFavorite"));
    }
  }

  if (!enabled) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
        <ScanSearch size={32} className="mx-auto mb-3 text-text-faint" />
        <p className="font-display text-base font-semibold text-text">{t("npc.roster.disabled.title")}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">
          {t("npc.roster.disabled.prefix")} <span className="text-accent-2">{t("chrome.feature.npcs")}</span> {t("npc.roster.disabled.suffix")}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg-elevated px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-2/15 text-accent-2">
            <ScanSearch size={20} />
          </div>
          <div>
            <p className="font-display text-base font-semibold text-text">{t("npc.roster.title")}</p>
            <p className="text-xs text-text-faint">
              {npcs.length} {t("npc.roster.characterCount", { count: npcs.length })}
              {settings?.autoScan ? t("npc.roster.autoScan", { interval: settings.autoScanInterval }) : t("npc.roster.manualScan")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onEvolve && npcs.length > 0 && (
            <Button
              variant="secondary"
              onClick={handleEvolve}
              disabled={evolving || scanning}
              title={t("npc.roster.evolveTitle", { messages: settings?.evolutionInterval ?? 20 })}
            >
              {evolving ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {evolving ? t("npc.roster.evolving") : t("npc.roster.evolve")}
            </Button>
          )}
          <Button variant="primary" onClick={onScan} disabled={scanning}>
            {scanning ? <Loader2 size={15} className="animate-spin" /> : <ScanSearch size={15} />}
            {scanning ? t("npc.roster.scanning") : t("npc.roster.scan")}
          </Button>
        </div>
      </div>

      {evolveResult && <p className="mb-4 -mt-2 text-xs text-accent-2">{evolveResult}</p>}

      {favorites.length > 0 && (
        <div className="mb-4 rounded-xl border border-border bg-bg-elevated p-3">
          <p className="mb-2 text-xs font-medium text-text-muted">
            <Star size={12} className="mr-1 inline text-accent-2" />
            {t("npc.roster.favorites.label", { count: favorites.length })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {favorites.map((f) => (
              <span key={f.id} className="flex items-center gap-1 rounded-full border border-border bg-bg px-2 py-1 text-xs text-text-muted">
                {f.name}
                <button onClick={() => importFavorite(f)} title={t("npc.roster.favorites.import")} className="cursor-pointer text-accent-2 hover:text-accent">
                  +
                </button>
                <button onClick={() => removeFavorite(f.id)} title={t("npc.roster.favorites.remove")} className="cursor-pointer text-text-faint hover:text-danger">
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {personas.length > 0 && (
        <div className="mb-4 rounded-xl border border-border bg-bg-elevated p-3">
          <p className="mb-2 text-xs font-medium text-text-muted">
            <UserCircle size={12} className="mr-1 inline text-accent-2" />
            {t("npc.roster.personas.label", { count: personas.length })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {personas.map((p) => (
              <span key={p.id} className="flex items-center gap-1 rounded-full border border-border bg-bg px-2 py-1 text-xs text-text-muted">
                {p.name}
                <button onClick={() => importPersona(p)} title={t("npc.roster.personas.import")} className="cursor-pointer text-accent-2 hover:text-accent">
                  +
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      {npcs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm text-text-muted">{t("npc.roster.empty.title")}</p>
          <p className="mt-1 text-xs text-text-faint">{t("npc.roster.empty.hint")}</p>
        </div>
      ) : (
        <div className="flex min-h-[320px] gap-4">
          {/* List */}
          <div className="flex w-60 shrink-0 flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-bg-elevated p-2">
            {npcs.map((npc) => {
              const isActive = npc.id === selected?.id;
              return (
                <button
                  key={npc.id}
                  onClick={() => setSelectedId(npc.id)}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                    isActive ? "bg-accent/15 text-text" : "text-text-muted hover:bg-bg-elevated-2"
                  }`}
                >
                  {getNpcAvatarUrl(npc, chat?.characterId, 64) ? (
                    <img src={getNpcAvatarUrl(npc, chat?.characterId, 64)} alt={npc.name} className="h-9 w-9 shrink-0 rounded-md border border-border object-cover" />
                  ) : (
                    <div className="h-9 w-9 shrink-0 rounded-md border border-dashed border-border bg-bg" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {npc.name || t("npc.roster.unnamed")}
                      {npc.isMainCharacter && <span className="ml-1 text-[10px] font-normal text-accent-2">{t("npc.roster.mainCharTag")}</span>}
                    </div>
                    {npc.values["role"] && <div className="truncate text-[11px] text-text-faint">{npc.values["role"]}</div>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail ficha */}
          {selected ? (
            <article className="flex-1 overflow-hidden rounded-xl border border-border bg-bg shadow-sm" style={{ borderTop: "3px solid var(--accent-2, #c8a05a)" }}>
              <header className="flex items-center gap-2 border-b border-border bg-bg-elevated px-4 py-2.5">
                <span className="font-mono text-[11px] font-semibold tracking-widest text-accent-2">
                  {t("npc.roster.number", { index: String(npcs.indexOf(selected) + 1).padStart(2, "0") })}
                </span>
                <input
                  value={selected.name}
                  onChange={(e) => updateNpc(selected.id, { name: e.target.value })}
                  className="min-w-0 flex-1 border-0 bg-transparent font-display text-lg font-semibold text-text outline-none placeholder:text-text-faint"
                  placeholder={t("npc.roster.namePlaceholder")}
                />
                {selected.isMainCharacter && (
                  <span
                    title={t("npc.roster.mainCharHint")}
                    className="shrink-0 rounded bg-accent-2/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-2"
                  >
                    {t("npc.roster.mainCharBadge")}
                  </span>
                )}
                <button
                  onClick={() => generatePortrait(selected)}
                  disabled={generatingId === selected.id || !selected.values["imageTags"]?.trim()}
                  title={t("npc.roster.generatePortrait")}
                  className="cursor-pointer rounded-md p-1.5 text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {generatingId === selected.id ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                </button>
                <button
                  onClick={() => favoriteNpc(selected)}
                  disabled={favoritingId === selected.id}
                  title={t("npc.roster.favorite")}
                  className="cursor-pointer rounded-md p-1.5 text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-accent-2 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {favoritingId === selected.id ? <Loader2 size={15} className="animate-spin" /> : <Star size={15} />}
                </button>
                <button
                  onClick={() => regenerateNpc(selected)}
                  disabled={regeneratingId === selected.id}
                  title={t("npc.roster.regenerate")}
                  className="cursor-pointer rounded-md p-1.5 text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {regeneratingId === selected.id ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                </button>
                <button
                  onClick={() => deleteNpc(selected.id)}
                  title={t("npc.roster.delete")}
                  className="cursor-pointer rounded-md p-1.5 text-text-muted transition-colors hover:bg-danger/15 hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              </header>

              <div className="flex gap-5 p-5">
                <div className="shrink-0">
                  {getNpcAvatarUrl(selected, chat?.characterId, 192) ? (
                    <img src={getNpcAvatarUrl(selected, chat?.characterId, 192)} alt={selected.name} className="h-36 w-36 rounded-lg border border-border object-cover shadow-sm" />
                  ) : (
                    <div className="flex h-36 w-36 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-bg-elevated text-text-faint">
                      <ImagePlus size={20} />
                      <span className="text-[10px]">{t("npc.roster.noPhoto")}</span>
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  {fields.map((f) => {
                    const requestKey = `${selected.id}:${f.key}`;
                    const value = selected.values[f.key] ?? "";
                    return (
                      <DossierFieldInput
                        key={f.key}
                        field={f}
                        value={value}
                        onChange={(v) => updateNpc(selected.id, { values: { ...selected.values, [f.key]: v } })}
                        headerAction={
                          f.evolveMode === "append" && value ? (
                            <button
                              onClick={() => consolidateField(selected, f.key)}
                              disabled={consolidatingKey === requestKey}
                              title={t("npc.roster.consolidate")}
                              className="flex shrink-0 cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-[10px] text-text-faint transition-colors hover:bg-bg-elevated-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {consolidatingKey === requestKey ? <Loader2 size={11} className="animate-spin" /> : <Minimize2 size={11} />}
                              {t("npc.roster.consolidateShort")}
                            </button>
                          ) : undefined
                        }
                      />
                    );
                  })}
                </div>
              </div>
            </article>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border text-sm text-text-faint">
              {t("npc.roster.selectCharacter")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
