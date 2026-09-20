import { useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import type { RecastData } from "../types/chat";
import { diffWords, type DiffSegment } from "../lib/textDiff";
import { useT, type TFunction } from "../i18n";
import { Button, textareaClasses } from "./ui";

interface Step {
  oldText: string;
  newText: string;
  label: string;
  tooltip: string;
}

/** Pass names come from the user's preset and are shown as-is; only the fallback label is copy. */
function buildSteps(data: RecastData, t: TFunction): Step[] {
  const s = data.snapshots;
  const steps: Step[] = [
    { oldText: s[0], newText: s[s.length - 1], label: t("chat.recast.fullDiff"), tooltip: t("chat.recast.fullDiffHint") },
  ];
  for (let i = 1; i < s.length; i++) {
    const passName = data.passNames[i - 1] ?? t("chat.recast.pass", { index: i });
    const prevName = i === 1 ? t("chat.recast.original") : (data.passNames[i - 2] ?? t("chat.recast.pass", { index: i - 1 }));
    steps.push({ oldText: s[i - 1], newText: s[i], label: `P${i}`, tooltip: `${prevName} → ${passName}` });
  }
  return steps;
}

function DiffText({ diff, side }: { diff: DiffSegment[]; side: "old" | "new" }) {
  return (
    <span className="whitespace-pre-wrap">
      {diff.map((seg, i) => {
        if (seg.type === "equal") return <span key={i}>{seg.value}</span>;
        if (side === "old" && seg.type === "removed") {
          return (
            <del key={i} className="rounded-sm bg-danger/20 text-danger">
              {seg.value}
            </del>
          );
        }
        if (side === "new" && seg.type === "added") {
          return (
            <ins key={i} className="rounded-sm bg-success/20 text-success no-underline">
              {seg.value}
            </ins>
          );
        }
        return null;
      })}
    </span>
  );
}

interface Props {
  data: RecastData;
  onAccept: (text: string) => void;
  onReject: () => void;
  onClose: () => void;
}

export function RecastDiffModal({ data, onAccept, onReject, onClose }: Props) {
  const t = useT();
  // Built on every render (it is a handful of steps) so a language change is reflected right away:
  // a memo keyed on `data` and the module-level `t` would keep the previous language until the
  // recast data itself changed.
  const steps = buildSteps(data, t);
  const [step, setStep] = useState(0);
  const [edited, setEdited] = useState(data.transformed);

  const current = steps[step];
  const isFullDiff = step === 0;
  const newText = isFullDiff ? edited : current.newText;
  const diff = diffWords(current.oldText, newText);

  function prev() {
    setStep((s) => Math.max(0, s - 1));
  }
  function next() {
    setStep((s) => Math.min(steps.length - 1, s + 1));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-bg-elevated px-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent-2" />
          <h2 className="font-display text-base font-semibold text-text">{t("chat.recast.title")}</h2>
        </div>
        {steps.length > 2 && (
          <div className="flex items-center gap-1">
            <button onClick={prev} disabled={step === 0} className="cursor-pointer rounded p-1 text-text-muted hover:text-text disabled:opacity-30">
              <ChevronLeft size={16} />
            </button>
            {steps.map((s, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                title={s.tooltip}
                className={`cursor-pointer rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  step === i ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text"
                }`}
              >
                {s.label}
              </button>
            ))}
            <button onClick={next} disabled={step === steps.length - 1} className="cursor-pointer rounded p-1 text-text-muted hover:text-text disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
        <button onClick={onClose} aria-label={t("common.actions.close")} className="cursor-pointer rounded-md p-1.5 text-text-muted hover:bg-bg-elevated-2 hover:text-text">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-border bg-bg-elevated p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t("chat.recast.original")}</div>
            <div className="text-sm leading-relaxed text-text">
              <DiffText diff={diff} side="old" />
            </div>
          </div>
          <div className="rounded-md border border-border bg-bg-elevated p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {isFullDiff ? t("chat.recast.transformedEditable") : t("chat.recast.transformed")}
            </div>
            {isFullDiff ? (
              <textarea value={edited} onChange={(e) => setEdited(e.target.value)} className={`${textareaClasses} h-64`} />
            ) : (
              <div className="text-sm leading-relaxed text-text">
                <DiffText diff={diff} side="new" />
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button variant="primary" onClick={() => onAccept(edited)}>
            {t("chat.recast.accept")}
          </Button>
          <Button variant="ghost" onClick={onReject}>
            {t("chat.recast.reject")}
          </Button>
          {isFullDiff && <span className="text-xs text-text-faint">{t("chat.recast.editHint")}</span>}
        </div>
      </div>
    </div>
  );
}
