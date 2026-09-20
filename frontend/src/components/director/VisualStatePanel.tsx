import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, ScanSearch, Shirt, Trash2 } from "lucide-react";
import { formatDateTime, useT } from "../../i18n";
import type { Chat } from "../../types/chat";
import type { CharacterVisualState } from "../../types/imageDirector";
import { Button, textareaClasses } from "../ui";

interface Props {
  chat: Chat | null;
  onUpdate: (visualState: Record<string, CharacterVisualState>) => void;
  onRunCheck?: () => Promise<void>;
  checkProcessing?: boolean;
  checkResult?: string | null;
}

function parseStateInput(value: string): string[] {
  return value.split(",").map((t) => t.trim()).filter(Boolean);
}

export function VisualStatePanel({ chat, onUpdate, onRunCheck, checkProcessing, checkResult }: Props) {
  const t = useT();
  const visualState = chat?.visualState ?? {};
  const names = Object.keys(visualState);
  const [selected, setSelected] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const activeName = selected && visualState[selected] ? selected : (names[0] ?? null);
  const active = activeName ? visualState[activeName] : null;

  function update(name: string, patch: Partial<CharacterVisualState>) {
    onUpdate({ ...visualState, [name]: { ...visualState[name], ...patch, updatedAt: Date.now() } });
  }

  function remove(name: string) {
    const next = { ...visualState };
    delete next[name];
    onUpdate(next);
    if (activeName === name) setSelected(null);
  }

  const checkToolbar = onRunCheck ? (
    <div className="mb-3 flex items-center gap-3 rounded-lg border border-border bg-bg-elevated px-3 py-2">
      <Button variant="secondary" size="sm" onClick={onRunCheck} disabled={checkProcessing}>
        {checkProcessing ? <Loader2 size={14} className="animate-spin" /> : <ScanSearch size={14} />}
        {checkProcessing ? t("director.visualState.checking") : t("director.visualState.check")}
      </Button>
      <span className="text-xs text-text-faint">
        {checkResult ?? t("director.visualState.checkHint")}
      </span>
    </div>
  ) : null;

  if (names.length === 0) {
    return (
      <div>
        {checkToolbar}
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <Shirt size={32} className="mx-auto mb-3 text-text-faint" />
          <p className="text-sm text-text-muted">{t("director.visualState.empty.title")}</p>
          <p className="mt-1 text-xs text-text-faint">{t("director.visualState.empty.hint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {checkToolbar}
      <div className="flex min-h-[320px] gap-4">
      <div className="flex w-52 shrink-0 flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-bg-elevated p-2">
        {names.map((name) => (
          <button
            key={name}
            onClick={() => {
              setSelected(name);
              setHistoryOpen(false);
            }}
            className={`truncate rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
              name === activeName ? "bg-accent/15 text-text" : "text-text-muted hover:bg-bg-elevated-2"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {active && activeName ? (
        <div className="flex-1 rounded-xl border border-border bg-bg p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-base font-semibold text-text">{activeName}</span>
            <button
              onClick={() => remove(activeName)}
              title={t("director.visualState.delete")}
              className="cursor-pointer rounded-md p-1.5 text-text-muted transition-colors hover:bg-danger/15 hover:text-danger"
            >
              <Trash2 size={15} />
            </button>
          </div>

          <label className="mb-3 block">
            <span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">
              {t("director.visualState.outfit")}
            </span>
            <textarea
              rows={2}
              value={active.outfit}
              onChange={(e) => update(activeName, { outfit: e.target.value })}
              className={textareaClasses}
              placeholder={t("director.visualState.outfitPlaceholder")}
            />
          </label>

          <label className="block">
            <span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">
              {t("director.visualState.state")}
            </span>
            <textarea
              rows={2}
              value={active.state.join(", ")}
              onChange={(e) => update(activeName, { state: parseStateInput(e.target.value) })}
              className={textareaClasses}
              placeholder={t("director.visualState.statePlaceholder")}
            />
            {active.state.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {active.state.map((tag) => (
                  <span key={tag} data-user-data className="rounded-md bg-accent-2/10 px-1.5 py-0.5 text-[10px] text-accent-2">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </label>

          <p className="mt-3 text-[11px] text-text-faint">
            {t("director.visualState.updatedAt", { date: active.updatedAt ? formatDateTime(active.updatedAt) : "—" })}
          </p>

          {active.history && active.history.length > 0 && (
            <div className="mt-3 border-t border-border pt-2">
              <button
                onClick={() => setHistoryOpen((o) => !o)}
                className="flex cursor-pointer items-center gap-1 text-[11px] font-medium text-text-muted hover:text-text"
              >
                {historyOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {t("director.visualState.history", { count: active.history.length })}
              </button>
              {historyOpen && (
                <ul className="mt-2 flex flex-col gap-1">
                  {[...active.history].reverse().map((h, i) => (
                    <li key={i} data-user-data className="text-[11px] text-text-faint">
                      <span className="text-text-muted">{formatDateTime(h.timestamp)}</span> — {h.summary}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border text-sm text-text-faint">
          {t("npc.roster.selectCharacter")}
        </div>
      )}
      </div>
    </div>
  );
}
