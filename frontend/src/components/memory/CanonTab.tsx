import { BookOpenCheck, Loader2, Merge, Pin, X } from "lucide-react";
import { useState } from "react";
import type { ActiveMemoryState, MemoryFact, MemoryFactStatus } from "../../types/activeMemory";
import { useT } from "../../i18n";
import { Alert, Button, inputClasses } from "../ui";
import { EmptySection, EvidenceList, FactStatusBadge, KnowledgeTick, NeedsReviewBadge } from "./memoryBits";
import { useMemoryAction } from "./memoryAction";
import {
  FACT_STATUS_LABELS,
  factSentence,
  percent,
  toggleVisibleTo,
  visibilityVocabulary,
  visibleToList,
} from "./memoryFormat";
import type { MemoryFactPatch, MemoryMergeTarget } from "./panelTypes";

interface Props {
  memory: ActiveMemoryState;
  savingIds: Set<string>;
  knownNames: string[];
  onUpdateFact?: (id: string, patch: MemoryFactPatch) => Promise<void>;
  onMerge?: (target: MemoryMergeTarget, keepId: string, mergeId: string) => Promise<void>;
  onGoToMessage?: (messageId: string) => void;
}

function VisibilityEditor({ fact, vocabulary, disabled, onApply }: {
  fact: MemoryFact;
  vocabulary: string[];
  disabled: boolean;
  onApply: (visibleTo: string[] | "all") => void;
}) {
  const t = useT();
  const isAll = fact.visibleTo === "all";
  const list = visibleToList(fact.visibleTo);
  const soleWitness = !isAll && list.length === 1;

  return (
    <div className="mt-3 rounded-md border border-border bg-bg-elevated p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text-muted">{t("memory.canon.editorTitle")}</span>
        <span className="text-xs text-text-faint">
          {isAll ? t("memory.canon.allCharacters") : t("memory.canon.witnessCount", { count: list.length })}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-text">
          <KnowledgeTick
            checked={isAll}
            disabled={disabled || isAll}
            label={isAll ? t("memory.canon.visibleToAll") : t("memory.canon.makeVisibleToAll")}
            onClick={() => onApply("all")}
          />
          <span className={isAll ? "text-text" : "text-text-muted"}>{t("memory.shared.everyone")}</span>
        </label>
        {vocabulary.map((name) => {
          const knows = isAll || list.includes(name);
          const isSoleWitness = soleWitness && list[0] === name;
          return (
            <label key={name} className="flex items-center gap-2 text-sm text-text">
              <KnowledgeTick
                checked={knows}
                disabled={disabled || isSoleWitness}
                label={isSoleWitness
                  ? t("memory.canon.soleWitness", { name })
                  : knows ? t("memory.canon.revoke", { name }) : t("memory.canon.grant", { name })}
                onClick={() => {
                  if (isSoleWitness) return;
                  onApply(toggleVisibleTo(fact.visibleTo, name, vocabulary));
                }}
              />
              <span className={knows ? "text-text" : "text-text-faint"}>{name}</span>
            </label>
          );
        })}
      </div>
      {vocabulary.length === 0 && (
        <p className="mt-3 text-xs text-text-faint">
          {t("memory.canon.noKnownNames")}
        </p>
      )}
      {soleWitness && (
        <p className="mt-3 text-xs text-text-faint">
          {t("memory.canon.lastWitnessNote")}
        </p>
      )}
    </div>
  );
}

function FactRow({ fact, saving, vocabulary, selectable, selected, onToggleSelect, onUpdate, onGoToMessage }: {
  fact: MemoryFact;
  saving: boolean;
  vocabulary: string[];
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onUpdate?: (id: string, patch: MemoryFactPatch) => Promise<void>;
  onGoToMessage?: (messageId: string) => void;
}) {
  const [editingVisibility, setEditingVisibility] = useState(false);
  const action = useMemoryAction(onUpdate);
  const t = useT();
  const busy = saving || action.busy;
  const sentence = factSentence(fact);

  async function apply(patch: MemoryFactPatch) {
    await action.run(fact.id, patch);
  }

  return (
    <article className={`rounded-lg border bg-bg p-4 ${fact.needsReview ? "border-warning/50" : "border-border"}`}>
      <div className="flex items-start gap-3">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={t("memory.canon.selectForMerge", { sentence })}
            className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-accent"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-text">
            <strong>{fact.subject}</strong> {fact.predicate} {fact.object}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-faint">
            <FactStatusBadge status={fact.status} />
            {fact.needsReview && <NeedsReviewBadge />}
            {fact.pinned && <span className="font-semibold text-accent-2">{t("memory.shared.pinned")}</span>}
            <span>{t("memory.shared.confidence", { percent: percent(fact.confidence) })}</span>
            <span>{t("memory.canon.importance", { importance: fact.importance })}</span>
            {fact.entityIds.length > 0 && <span>{t("memory.canon.entities", { ids: fact.entityIds.join(", ") })}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void apply({ pinned: !fact.pinned })}
          disabled={busy}
          aria-pressed={Boolean(fact.pinned)}
          aria-label={fact.pinned ? t("memory.canon.unpin") : t("memory.canon.pin")}
          title={fact.pinned ? t("memory.canon.unpin") : t("memory.canon.pin")}
          className={`rounded-md border p-2 transition-colors disabled:cursor-wait disabled:opacity-50 ${
            fact.pinned ? "border-accent/50 bg-accent/15 text-accent" : "border-border text-text-muted hover:bg-bg-elevated-2 hover:text-text"
          }`}
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Pin size={15} className={fact.pinned ? "fill-current" : ""} />}
        </button>
      </div>

      <EvidenceList ids={fact.evidenceMessageIds} onGoToMessage={onGoToMessage} className="mt-3" />

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <label htmlFor={`fact-status-${fact.id}`} className="text-xs font-semibold text-text-muted">{t("memory.shared.status")}</label>
        <select
          id={`fact-status-${fact.id}`}
          value={fact.status}
          disabled={busy}
          onChange={(event) => void apply({ status: event.target.value as MemoryFactStatus })}
          className={`${inputClasses} w-auto py-1 text-xs`}
        >
          {Object.entries(FACT_STATUS_LABELS).map(([value, labelKey]) => <option key={value} value={value}>{t(labelKey)}</option>)}
        </select>
        {fact.needsReview && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void apply({ needsReview: false })}>
            {t("memory.canon.markReviewed")}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          disabled={busy}
          aria-expanded={editingVisibility}
          onClick={() => setEditingVisibility((current) => !current)}
        >
          {editingVisibility ? t("memory.canon.hideVisibility") : t("memory.canon.editVisibility")}
        </Button>
      </div>

      {editingVisibility && (
        <VisibilityEditor
          fact={fact}
          vocabulary={vocabulary}
          disabled={busy}
          onApply={(visibleTo) => void apply({ visibleTo })}
        />
      )}

      {action.error && <p className="mt-2 text-xs text-danger">{action.error}</p>}
    </article>
  );
}

function MergeBar({ facts, selected, keepId, busy, error, onKeep, onCancel, onMerge }: {
  facts: MemoryFact[];
  selected: string[];
  keepId: string | null;
  busy: boolean;
  error: string | null;
  onKeep: (id: string) => void;
  onCancel: () => void;
  onMerge: () => void;
}) {
  const t = useT();
  const candidates = facts.filter((fact) => selected.includes(fact.id));
  return (
    <div className="rounded-lg border border-accent/40 bg-accent/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
            <Merge size={15} />
            {t("memory.canon.mergeTitle")}
          </h3>
          <p className="mt-1 text-xs text-text-muted">
            {t("memory.canon.mergeBody")}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          <X size={14} />
          {t("common.actions.cancel")}
        </Button>
      </div>
      <fieldset className="mt-3 space-y-1.5" disabled={busy}>
        <legend className="sr-only">{t("memory.canon.mergeLegend")}</legend>
        {candidates.map((fact) => (
          <label key={fact.id} className="flex items-start gap-2 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text">
            <input
              type="radio"
              name="merge-survivor"
              checked={keepId === fact.id}
              onChange={() => onKeep(fact.id)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent"
            />
            <span>{factSentence(fact)}</span>
          </label>
        ))}
      </fieldset>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="primary" disabled={busy || !keepId} onClick={onMerge}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Merge size={14} />}
          {t("memory.canon.merge")}
        </Button>
        <span className="text-xs text-text-faint">{t("memory.canon.mergeKeeps")}</span>
      </div>
      {error && <div className="mt-3"><Alert kind="error">{error}</Alert></div>}
    </div>
  );
}

export function CanonTab({ memory, savingIds, knownNames, onUpdateFact, onMerge, onGoToMessage }: Props) {
  const t = useT();
  const [selected, setSelected] = useState<string[]>([]);
  const [keepId, setKeepId] = useState<string | null>(null);
  const merge = useMemoryAction(onMerge);
  const selectable = Boolean(onMerge) && memory.facts.length > 1;

  if (memory.facts.length === 0) {
    return (
      <EmptySection
        icon={BookOpenCheck}
        title={t("memory.canon.emptyTitle")}
        body={t("memory.canon.emptyBody")}
      />
    );
  }

  function toggleSelect(id: string) {
    merge.clearError();
    const next = selected.includes(id)
      ? selected.filter((entry) => entry !== id)
      : selected.length >= 2
        ? [selected[1], id]
        : [...selected, id];
    setSelected(next);
    if (!keepId || !next.includes(keepId)) setKeepId(next[0] ?? null);
  }

  async function confirmMerge() {
    if (selected.length !== 2 || !keepId) return;
    const mergeId = selected.find((id) => id !== keepId);
    if (!mergeId) return;
    // The bar only closes when the merge actually went through, so a failure keeps the selection.
    const outcome = await merge.run("fact", keepId, mergeId);
    if (outcome.ok) {
      setSelected([]);
      setKeepId(null);
    }
  }

  return (
    <div className="space-y-3">
      {selectable && (
        <p className="text-xs text-text-faint">
          {selected.length === 0
            ? t("memory.canon.hintNone")
            : selected.length === 1
              ? t("memory.canon.hintOne")
              : null}
        </p>
      )}
      {selected.length === 2 && (
        <MergeBar
          facts={memory.facts}
          selected={selected}
          keepId={keepId}
          busy={merge.busy}
          error={merge.error}
          onKeep={setKeepId}
          onCancel={() => { setSelected([]); setKeepId(null); merge.clearError(); }}
          onMerge={() => void confirmMerge()}
        />
      )}
      {memory.facts.map((fact) => (
        <FactRow
          key={fact.id}
          fact={fact}
          saving={savingIds.has(`fact:${fact.id}`)}
          vocabulary={visibilityVocabulary(knownNames, fact.visibleTo)}
          selectable={selectable}
          selected={selected.includes(fact.id)}
          onToggleSelect={() => toggleSelect(fact.id)}
          onUpdate={onUpdateFact}
          onGoToMessage={onGoToMessage}
        />
      ))}
    </div>
  );
}
