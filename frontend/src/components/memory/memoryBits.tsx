import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AlertTriangle, Check, MessageSquare, Minus, ShieldAlert, ShieldCheck } from "lucide-react";
import type { GuardFinding, MemoryFactStatus, MemoryThreadStatus } from "../../types/activeMemory";
import { useT } from "../../i18n";
import { Badge } from "../ui";
import {
  FACT_STATUS_LABELS,
  SEVERITY_LABELS,
  THREAD_STATUS_LABELS,
  shortId,
} from "./memoryFormat";

export function LoadingState({ label }: { label?: string }) {
  const t = useT();
  const ariaLabel = label ?? t("memory.bits.loading");
  return (
    <div aria-label={ariaLabel} className="space-y-3">
      {["w-2/3", "w-full", "w-5/6"].map((width, index) => (
        <div key={index} className="rounded-lg border border-border bg-bg p-4">
          <div className={`h-3 ${width} animate-pulse rounded bg-bg-elevated-2`} />
          <div className="mt-3 h-2 w-1/3 animate-pulse rounded bg-bg-elevated-2" />
        </div>
      ))}
    </div>
  );
}

export function EmptySection({ icon: Icon, title, body, action }: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <Icon size={28} className="mx-auto text-text-faint" />
      <h3 className="mt-3 font-display text-base font-semibold text-text">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-text-muted">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function FactStatusBadge({ status }: { status: MemoryFactStatus }) {
  const t = useT();
  const tone = status === "confirmed" ? "accent" : status === "candidate" ? "accent2" : "neutral";
  return <Badge tone={tone}>{t(FACT_STATUS_LABELS[status])}</Badge>;
}

export function ThreadStatusBadge({ status }: { status: MemoryThreadStatus }) {
  const t = useT();
  const tone = status === "open" ? "accent" : status === "resolved" ? "accent2" : "neutral";
  return <Badge tone={tone}>{t(THREAD_STATUS_LABELS[status])}</Badge>;
}

/** Flags an item the backend marked as needing a human look (an edit or deletion touched it). */
export function NeedsReviewBadge({ what }: { what?: string }) {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
      <AlertTriangle size={12} />
      {what ?? t("memory.bits.needsReview")}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: GuardFinding["severity"] }) {
  const t = useT();
  const classes = severity === "high"
    ? "bg-danger/15 text-danger"
    : severity === "medium"
      ? "bg-warning/15 text-warning"
      : "bg-bg-elevated-2 text-text-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${classes}`}>
      {t(SEVERITY_LABELS[severity])}
    </span>
  );
}

export function GuardStateBadge({ findings }: { findings: number }) {
  const t = useT();
  if (findings === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
        <ShieldCheck size={12} />
        {t("memory.bits.noFindings")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-xs font-semibold text-danger">
      <ShieldAlert size={12} />
      {t("memory.bits.findings", { count: findings })}
    </span>
  );
}

/**
 * Message ids behind an item. They jump to the source message when the host wires
 * `onGoToMessage`; otherwise they stay visible (read-only) so the evidence is never hidden.
 */
export function EvidenceList({ ids, onGoToMessage, className = "" }: {
  ids: string[];
  onGoToMessage?: (messageId: string) => void;
  className?: string;
}) {
  const t = useT();
  if (!ids.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className="inline-flex items-center gap-1 text-xs text-text-faint">
        <MessageSquare size={12} />
        {t("memory.bits.evidence")}
      </span>
      {ids.map((id) => onGoToMessage ? (
        <button
          key={id}
          type="button"
          onClick={() => onGoToMessage(id)}
          title={t("memory.bits.goToMessage", { id })}
          aria-label={t("memory.bits.goToSourceMessage", { id })}
          className="cursor-pointer rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px] text-text-muted transition-colors hover:border-accent hover:text-text"
        >
          {shortId(id)}
        </button>
      ) : (
        <span
          key={id}
          title={t("memory.bits.sourceMessage", { id })}
          className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px] text-text-faint"
        >
          {shortId(id)}
        </span>
      ))}
    </div>
  );
}

/** Jumps to the message behind a piece of evidence when the host knows how to navigate. */
export function JumpToMessage({ messageId, onGoToMessage, className = "" }: {
  messageId?: string;
  onGoToMessage?: (messageId: string) => void;
  className?: string;
}) {
  const t = useT();
  if (!messageId || !onGoToMessage) return null;
  return (
    <button
      type="button"
      onClick={() => onGoToMessage(messageId)}
      className={`inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-accent hover:underline ${className}`}
    >
      <MessageSquare size={12} />
      {t("memory.bits.viewMessage")}
    </button>
  );
}

/** Checkbox-look toggle used by the knowledge matrix and the visibility editor. */
export function KnowledgeTick({ checked, disabled, label, onClick }: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border transition-colors
        disabled:cursor-not-allowed disabled:opacity-30
        ${checked ? "border-accent/60 bg-accent/15 text-accent" : "border-border text-text-faint hover:border-border-strong hover:text-text-muted"}`}
    >
      {checked ? <Check size={13} /> : <Minus size={13} />}
    </button>
  );
}
