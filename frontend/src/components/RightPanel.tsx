import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Check, ChevronDown, ChevronRight, History, Pencil, Plus, Search, Star, Trash2, UserPlus, Users } from "lucide-react";
import { useCharacters } from "../hooks/useCharacters";
import { usePersonas } from "../hooks/usePersonas";
import { useSettings } from "../hooks/useSettings";
import * as charactersApi from "../api/characters";
import type { ChatSummary } from "../types/chat";
import { useT } from "../i18n";
import { Button, inputClasses } from "./ui";

interface Props {
  chats: ChatSummary[];
  activeChatId: string | null;
  charactersVersion: number;
  onSelect: (id: string) => void;
  onCreate: (opts: { characterId?: string; personaId?: string }) => void;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEditCharacter: (id: string) => void;
  onOpenPersonas: () => void;
  onCollapse: () => void;
  width: number;
}

export function RightPanel({
  chats,
  activeChatId,
  charactersVersion,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onEditCharacter,
  onOpenPersonas,
  onCollapse,
  width,
}: Props) {
  const t = useT();
  const { characters, refresh, remove } = useCharacters();
  const { personas } = usePersonas();
  const { settings, update } = useSettings();
  const [search, setSearch] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [personasOpen, setPersonasOpen] = useState(false);
  const [recentChatsOpen, setRecentChatsOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const pngRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refresh();
  }, [refresh, charactersVersion]);

  const favoriteIds = settings?.favoriteCharacterIds ?? [];
  const filtered = characters
    .filter((c) => !search.trim() || c.name.toLowerCase().includes(search.toLowerCase()))
    .filter((c) => !onlyFavorites || favoriteIds.includes(c.id))
    .sort((a, b) => {
      const fa = favoriteIds.includes(a.id) ? 1 : 0;
      const fb = favoriteIds.includes(b.id) ? 1 : 0;
      if (fa !== fb) return fb - fa;
      return b.addedAt - a.addedAt;
    });
  const recentChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);

  function chatsFor(characterId: string): ChatSummary[] {
    return chats.filter((c) => c.characterId === characterId).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function resolveDefaultPersonaId(): string | undefined {
    if (settings?.defaultPersonaId) return settings.defaultPersonaId;
    if (personas.length === 1) return personas[0].id;
    return undefined;
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function isOpenFor(c: { id: string }) {
    return expanded.has(c.id) || chatsFor(c.id).some((ch) => ch.id === activeChatId);
  }

  async function handleCreate() {
    const card = await charactersApi.createCharacter({ name: t("chrome.library.newCharacter") });
    await refresh();
    onEditCharacter(card.id);
  }

  async function handleImport(file: File, kind: "png" | "json") {
    const card = kind === "png" ? await charactersApi.importPng(file) : await charactersApi.importJson(file);
    await refresh();
    onEditCharacter(card.id);
  }

  function onPngChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void handleImport(file, "png");
  }
  function onJsonChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void handleImport(file, "json");
  }

  async function setDefaultPersona(id: string) {
    if (!settings) return;
    await update({ ...settings, defaultPersonaId: id });
  }

  function toggleFavorite(id: string) {
    if (!settings) return;
    const favs = new Set(settings.favoriteCharacterIds ?? []);
    if (favs.has(id)) favs.delete(id);
    else favs.add(id);
    void update({ ...settings, favoriteCharacterIds: [...favs] });
  }

  async function commitRename(id: string) {
    if (renameDraft.trim()) await onRename(id, renameDraft.trim());
    setRenamingId(null);
  }

  async function handleDeleteCharacter(id: string, name: string) {
    if (!window.confirm(t("chrome.library.deleteCharacterConfirm", { name }))) return;
    await remove(id);
  }

  return (
    <aside className="workspace-panel workspace-panel--right flex h-full shrink-0 flex-col" style={{ width }} data-tour="library">
      <div className="workspace-panel__header flex shrink-0 items-center justify-between px-3 py-2">
        <div>
          <span className="panel-kicker block">{t("chrome.library.title")}</span>
          <span className="font-display text-sm font-semibold text-text">{t("chrome.library.characters")}</span>
        </div>
        <button onClick={onCollapse} title={t("chrome.panel.hide")} aria-label={t("chrome.panel.hide")} className="cursor-pointer rounded p-1 text-text-faint transition-colors hover:text-text">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="shrink-0 border-b border-border p-2.5">
        <div className="relative mb-2">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" />
          <input
            placeholder={t("chrome.library.searchCharacter")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClasses} py-1.5! pl-8 text-sm`}
          />
        </div>
        <div className="mb-2 flex flex-wrap gap-1 overflow-y-auto pr-1">
          <button
            onClick={() => setOnlyFavorites((v) => !v)}
            title={t("chrome.library.favoritesOnly")}
            className={`flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] leading-tight transition-colors ${
              onlyFavorites ? "border-accent-2 bg-accent-2/20 text-accent-2" : "border-border text-text-muted hover:text-text"
            }`}
          >
            <Star size={11} className={onlyFavorites ? "fill-current" : ""} />
            {t("chrome.library.favorites")}
          </button>
          {onlyFavorites && (
            <button
              onClick={() => setOnlyFavorites(false)}
              title={t("chrome.library.clearFilters")}
              className="cursor-pointer rounded-full border border-danger/50 px-2 py-0.5 text-[10px] leading-tight text-danger transition-colors hover:border-danger"
            >
              {t("chrome.library.clear")}
            </button>
          )}
        </div>
        <div className="flex gap-1.5" data-tour="library-actions">
          <Button variant="primary" size="sm" onClick={handleCreate} className="flex-1">
            <UserPlus size={14} />
            {t("chrome.library.new")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => pngRef.current?.click()} title={t("chrome.library.importPng")}>
            {t("chrome.library.png")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => jsonRef.current?.click()} title={t("chrome.library.importJson")}>
            {t("chrome.library.json")}
          </Button>
          <input ref={pngRef} type="file" accept="image/png" hidden onChange={onPngChange} />
          <input ref={jsonRef} type="file" accept="application/json" hidden onChange={onJsonChange} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {filtered.length === 0 && <p className="px-1 py-2 text-xs text-text-faint">{t("chrome.library.noCharacters")}</p>}
        <div className="character-grid grid grid-cols-3 gap-2" data-tour="character-grid">
          {filtered.map((c) => {
            const open = isOpenFor(c);
            const charChats = chatsFor(c.id);
            const isFav = favoriteIds.includes(c.id);
            return (
              <div key={c.id} className="contents">
                <div className="group cursor-pointer" onClick={() => toggleExpand(c.id)}>
                  <div className={`character-tile relative overflow-hidden border ${isFav ? "border-accent-2" : open ? "border-accent" : "border-border"}`}>
                    <img
                      src={charactersApi.thumbnailUrl(c.id, 192, c.mtimeMs)}
                      alt={c.name}
                      loading="lazy"
                      decoding="async"
                      className="aspect-square w-full object-cover transition-opacity group-hover:opacity-90"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(c.id);
                      }}
                      title={isFav ? t("chrome.library.removeFavorite") : t("chrome.library.addFavorite")}
                      aria-label={t("chrome.library.favorite")}
                      className={`absolute right-1 top-1 cursor-pointer rounded-full bg-black/60 p-1.5 transition-colors ${
                        isFav ? "text-accent-2" : "text-text hover:text-accent-2"
                      }`}
                    >
                      <Star size={14} className={isFav ? "fill-current" : ""} />
                    </button>
                    {charChats.length > 0 && (
                      <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] leading-none text-text">
                        {charChats.length}
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/60 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreate({ characterId: c.id, personaId: resolveDefaultPersonaId() });
                        }}
                        title={t("chrome.library.newChat")}
                        aria-label={t("chrome.library.newChat")}
                        className="cursor-pointer rounded p-1 text-text transition-colors hover:text-accent"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditCharacter(c.id);
                        }}
                        title={t("chrome.library.editCharacter")}
                        aria-label={t("chrome.library.editCharacter")}
                        className="cursor-pointer rounded p-1 text-text transition-colors hover:text-accent"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCharacter(c.id, c.name);
                        }}
                        title={t("chrome.library.deleteCharacter")}
                        aria-label={t("chrome.library.deleteCharacter")}
                        className="cursor-pointer rounded p-1 text-text transition-colors hover:text-danger"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <span className="mt-1 block truncate text-center text-xs text-text" data-user-data>
                    {c.name}
                  </span>
                </div>

                {open && (
                  <div className="col-span-3 mb-1 rounded-md border border-border bg-bg-elevated-2/50 p-1">
                    {charChats.length === 0 ? (
                      <p className="px-2 py-1 text-xs text-text-faint">{t("chrome.library.noChatsForCharacter")}</p>
                    ) : (
                      charChats.map((chat) => {
                        const isActive = chat.id === activeChatId;
                        return (
                          <div
                            key={chat.id}
                            onClick={() => onSelect(chat.id)}
                            className={`group flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-sm transition-colors hover:bg-bg-elevated-2 ${
                              isActive ? "bg-bg-elevated-2 text-text" : "text-text-muted"
                            }`}
                          >
                            {renamingId === chat.id ? (
                              <input
                                autoFocus
                                value={renameDraft}
                                onChange={(e) => setRenameDraft(e.target.value)}
                                onBlur={() => commitRename(chat.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") commitRename(chat.id);
                                  if (e.key === "Escape") setRenamingId(null);
                                }}
                                className={`${inputClasses} py-0.5! text-sm`}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <>
                                <span className="min-w-0 flex-1 truncate" data-user-data>
                                  {chat.title || t("chrome.library.noTitle")}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingId(chat.id);
                                    setRenameDraft(chat.title);
                                  }}
                                  title={t("chrome.library.rename")}
                                  className="cursor-pointer rounded p-1 text-text-faint opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(chat.id);
                                  }}
                                  title={t("chrome.library.deleteChat")}
                                  className="cursor-pointer rounded p-1 text-text-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-t border-border">
        <button
          onClick={() => setRecentChatsOpen((o) => !o)}
          className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text"
        >
          <History size={14} />
          <span className="flex-1 text-left">{t("chrome.library.recentChats")}</span>
          {recentChatsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {recentChatsOpen && (
          <div className="max-h-48 overflow-y-auto px-1 pb-2">
            {recentChats.length === 0 && <p className="px-2 py-1 text-xs text-text-faint">{t("chrome.library.noChats")}</p>}
            {recentChats.map((chat) => {
              const c = characters.find((ch) => ch.id === chat.characterId);
              const isActive = chat.id === activeChatId;
              return (
                <div
                  key={chat.id}
                  onClick={() => onSelect(chat.id)}
                  className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm transition-colors hover:bg-bg-elevated-2 ${
                    isActive ? "bg-bg-elevated-2 text-text" : "text-text-muted"
                  }`}
                >
                  {c ? (
                    <img
                      src={charactersApi.thumbnailUrl(c.id, 64, c.mtimeMs)}
                      alt={c.name}
                      loading="lazy"
                      decoding="async"
                      className="h-6 w-6 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <span className="h-6 w-6 shrink-0 rounded-full border border-border bg-bg-elevated-2" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate" data-user-data>
                      {chat.title || t("chrome.library.noTitle")}
                    </div>
                    {c && (
                      <div className="truncate text-xs text-text-faint" data-user-data>
                        {c.name}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border">
        <button
          onClick={() => setPersonasOpen((o) => !o)}
          className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text"
        >
          <Users size={14} />
          <span className="flex-1 text-left">{t("chrome.library.personas")}</span>
          {personasOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {personasOpen && (
          <div className="px-3 pb-2">
            {personas.length === 0 && <p className="text-xs text-text-faint">{t("chrome.library.noPersonas")}</p>}
            {personas.map((p) => {
              const isDefault = settings?.defaultPersonaId === p.id || (settings?.defaultPersonaId == null && personas.length === 1);
              return (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 py-1 text-sm text-text-muted hover:text-text">
                  <input type="radio" checked={isDefault} onChange={() => setDefaultPersona(p.id)} className="accent-accent" />
                  <span className="flex-1 truncate">{p.name}</span>
                  {isDefault && (
                    <span className="flex items-center gap-0.5 text-[10px] text-accent">
                      <Check size={11} /> {t("chrome.library.defaultBadge")}
                    </span>
                  )}
                </label>
              );
            })}
            <button onClick={onOpenPersonas} className="mt-1 cursor-pointer text-xs text-accent transition-colors hover:text-accent-hover">
              {t("chrome.library.managePersonas")}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
