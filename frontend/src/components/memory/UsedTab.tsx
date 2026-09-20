import { CircleAlert, ShieldCheck, Sparkles } from "lucide-react";
import type { ActiveMemoryState, GuardFinding, MemoryBriefTrace } from "../../types/activeMemory";
import { useT } from "../../i18n";
import { Alert, Badge } from "../ui";
import { EmptySection, GuardStateBadge, JumpToMessage, SeverityBadge } from "./memoryBits";
import {
  GUARD_METHOD_LABELS,
  factSentence,
  formatDate,
  itemLabel,
  itemMessageId,
} from "./memoryFormat";

interface Props {
  memory: ActiveMemoryState;
  onGoToMessage?: (messageId: string) => void;
}

interface ExplainedItem {
  key: string;
  type: string;
  text: string;
  score?: number;
  reasons: string;
  messageId?: string;
}

function explainedItems(memory: ActiveMemoryState, brief: MemoryBriefTrace): ExplainedItem[] {
  // The backend explains each selection (type, id, score and why it was picked) instead of sending
  // a flat id list, so the panel can show the reasoning that produced the brief.
  return (brief.selected ?? []).map((selection, index) => ({
    key: `${selection.type ?? "item"}:${selection.id ?? index}`,
    type: selection.type,
    text: itemLabel(memory, selection.type, selection.id) ?? selection.id,
    score: selection.score,
    reasons: (selection.reasons ?? []).join(" · "),
    messageId: itemMessageId(memory, selection.type, selection.id),
  }));
}

function GuardFindingRow({ finding, memory, onGoToMessage }: {
  finding: GuardFinding;
  memory: ActiveMemoryState;
  onGoToMessage?: (messageId: string) => void;
}) {
  const fact = memory.facts.find((entry) => entry.id === finding.factId);
  const messageId = fact?.evidenceMessageIds[0];
  const t = useT();
  return (
    <div className="rounded-lg border border-border bg-bg p-3">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={finding.severity} />
        <span className="text-xs font-semibold text-text-muted">{fact ? factSentence(fact) : t("memory.used.factFallback", { id: finding.factId })}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-text">{finding.reason}</p>
      {finding.excerpt && (
        <blockquote className="mt-2 border-l-2 border-border-strong pl-3 text-xs italic leading-relaxed text-text-muted">
          {finding.excerpt}
        </blockquote>
      )}
      <JumpToMessage messageId={messageId} onGoToMessage={onGoToMessage} className="mt-2" />
    </div>
  );
}

export function UsedTab({ memory, onGoToMessage }: Props) {
  const t = useT();
  const brief = memory.lastBrief ?? null;
  const guard = memory.lastGuard ?? null;
  const items = brief ? explainedItems(memory, brief) : [];
  const briefText = brief?.brief?.trim() ? brief.brief : null;
  const findings = guard?.findings ?? [];

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-text">
          <Sparkles size={15} />
          {t("memory.used.briefTitle")}
        </h3>
        {!brief ? (
          <EmptySection
            icon={Sparkles}
            title={t("memory.used.emptyBriefTitle")}
            body={t("memory.used.emptyBriefBody")}
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-faint">
              <span>{t("memory.shared.characters", { count: briefText ? briefText.length : 0 })}</span>
              {formatDate(brief.generatedAt) && <span>{formatDate(brief.generatedAt)}</span>}
              {brief.responderId && <span>{t("memory.used.responder", { id: brief.responderId })}</span>}
              {brief.omittedCount > 0 && <span>{t("memory.shared.omitted", { count: brief.omittedCount })}</span>}
            </div>
            {briefText && (
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-bg p-4 font-mono text-xs leading-relaxed text-text">
                {briefText}
              </pre>
            )}
            {items.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-text">{t("memory.used.selectionTitle")}</h4>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.key} className="rounded-lg border border-border bg-bg p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.type && <Badge tone="accent2">{item.type}</Badge>}
                        {item.score !== undefined && <span className="text-xs text-text-faint">{t("memory.used.score", { score: item.score })}</span>}
                        <JumpToMessage messageId={item.messageId} onGoToMessage={onGoToMessage} className="ml-auto" />
                      </div>
                      <p className="mt-1 text-sm text-text">{item.text}</p>
                      {item.reasons && <p className="mt-1 text-xs leading-relaxed text-text-muted">{item.reasons}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!briefText && items.length === 0 && (
              <EmptySection
                icon={CircleAlert}
                title={t("memory.used.emptyTraceTitle")}
                body={t("memory.used.emptyTraceBody")}
              />
            )}
          </>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-text">
            <ShieldCheck size={15} />
            {t("memory.used.guardTitle")}
          </h3>
          {guard && <GuardStateBadge findings={findings.length} />}
        </div>
        {!guard ? (
          <EmptySection
            icon={ShieldCheck}
            title={t("memory.used.emptyGuardTitle")}
            body={t("memory.used.emptyGuardBody")}
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-faint">
              {formatDate(guard.checkedAt) && <span>{formatDate(guard.checkedAt)}</span>}
              <span>{t(GUARD_METHOD_LABELS[guard.method])}</span>
              {guard.messageId && <span className="font-mono">{guard.messageId.slice(0, 8)}…</span>}
            </div>
            {findings.length === 0 ? (
              <Alert kind="success">{t("memory.used.guardOk")}</Alert>
            ) : (
              <div className="space-y-2">
                {findings.map((finding, index) => (
                  <GuardFindingRow key={`${finding.factId}:${index}`} finding={finding} memory={memory} onGoToMessage={onGoToMessage} />
                ))}
              </div>
            )}
            {guard.warnings.length > 0 && (
              <ul className="list-disc space-y-1 pl-4 text-xs text-warning">
                {guard.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
