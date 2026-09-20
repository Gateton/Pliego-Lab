import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Coins, MessageSquare, TrendingDown, TrendingUp } from "lucide-react";
import { getUsageEvents } from "../../api/usage";
import { listProviderModels } from "../../api/providers";
import { listChats } from "../../api/chats";
import { formatNumber, useT } from "../../i18n";
import type { TranslationKey } from "../../i18n";
import type { UsageEvent, UsageStage } from "../../types/usage";
import type { ModelDescriptor } from "../../types/provider";
import type { ChatSummary } from "../../types/chat";
import { PageHeader } from "../ui";

/** Modules that own a stage keep their name: the shell already has a key for each of those names. */
const STAGE_LABEL_KEYS: Record<UsageStage, TranslationKey> = {
  main: "usage.stage.main",
  director: "chrome.modal.director",
  recast: "chrome.modal.recast",
  npcTracker: "chrome.modal.npc",
  memory: "usage.stage.memory",
  memoryPlus: "usage.stage.memoryPlus",
  characterGen: "usage.stage.characterGen",
};

function formatCost(cost: number | null): string {
  if (cost === null) return "—";
  if (cost === 0) return "$0.00";
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
}

function formatTokens(n: number): string {
  return formatNumber(n);
}

interface Totals {
  promptTokens: number;
  completionTokens: number;
  cost: number | null;
  hasUnknownPricing: boolean;
}

function sumEvents(events: UsageEvent[], pricing: Map<string, { prompt: number; completion: number }>): Totals {
  let promptTokens = 0;
  let completionTokens = 0;
  let cost = 0;
  let hasUnknownPricing = false;
  for (const e of events) {
    // Normalized fields are authoritative; the legacy pair only exists on events recorded before
    // usage was normalized across providers.
    const input = e.inputTokens ?? e.promptTokens ?? 0;
    const output = e.outputTokens ?? e.completionTokens ?? 0;
    promptTokens += input;
    completionTokens += output;
    // A provider-reported cost is exact — never second-guess it with an estimate.
    if (typeof e.costUsd === "number") {
      cost += e.costUsd;
      continue;
    }
    const price = pricing.get(e.model);
    if (price) cost += input * price.prompt + output * price.completion;
    else hasUnknownPricing = true;
  }
  return { promptTokens, completionTokens, cost: hasUnknownPricing && cost === 0 ? null : cost, hasUnknownPricing };
}

function StatTile({ icon: Icon, label, value, accent }: { icon: typeof Coins; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-1 items-center gap-3 rounded-xl border border-border bg-bg-elevated px-4 py-3.5">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent ? "bg-accent-2/15 text-accent-2" : "bg-bg-elevated-2 text-text-muted"}`}>
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-text-faint">{label}</p>
        <p className={`truncate font-display text-lg font-semibold ${accent ? "text-accent-2" : "text-text"}`}>{value}</p>
      </div>
    </div>
  );
}

interface ChatUsageRow {
  chatId: string;
  title: string;
  messageCount: number;
  totals: Totals;
  stages: Array<{ stage: UsageStage; provider: string; model: string; totals: Totals }>;
}

export function UsageDashboard() {
  const t = useT();
  const [events, setEvents] = useState<UsageEvent[] | null>(null);
  const [models, setModels] = useState<ModelDescriptor[]>([]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAllChats, setShowAllChats] = useState(false);

  useEffect(() => {
    getUsageEvents().then(setEvents);
    // OpenRouter is the only provider that publishes per-token pricing, so its model list is the
    // only source for estimating a cost when an event has no provider-reported one.
    listProviderModels("openrouter")
      .then(setModels)
      .catch(() => setModels([]));
    listChats().then(setChats).catch(() => setChats([]));
  }, []);

  const pricing = useMemo(() => {
    const map = new Map<string, { prompt: number; completion: number }>();
    for (const m of models) {
      if (m.pricing) map.set(m.id, { prompt: m.pricing.prompt, completion: m.pricing.completion });
    }
    return map;
  }, [models]);

  const eventsByChat = useMemo(() => {
    const map = new Map<string, UsageEvent[]>();
    for (const e of events ?? []) {
      if (e.chatId === null) continue;
      if (!map.has(e.chatId)) map.set(e.chatId, []);
      map.get(e.chatId)!.push(e);
    }
    return map;
  }, [events]);

  const globalEvents = useMemo(() => (events ?? []).filter((e) => e.chatId === null), [events]);
  const globalTotals = useMemo(() => sumEvents(globalEvents, pricing), [globalEvents, pricing]);
  const globalStages = useMemo(() => {
    const byStageModel = new Map<string, { stage: UsageStage; provider: string; model: string; events: UsageEvent[] }>();
    for (const e of globalEvents) {
      const key = `${e.stage}::${e.provider}::${e.model}`;
      if (!byStageModel.has(key)) byStageModel.set(key, { stage: e.stage, provider: e.provider, model: e.model, events: [] });
      byStageModel.get(key)!.events.push(e);
    }
    return [...byStageModel.values()]
      .map(({ stage, provider, model, events: stageEvents }) => ({ stage, provider, model, totals: sumEvents(stageEvents, pricing) }))
      .sort((a, b) => (b.totals.cost ?? 0) - (a.totals.cost ?? 0));
  }, [globalEvents, pricing]);

  const chatRows = useMemo((): ChatUsageRow[] => {
    return chats.map((chat) => {
      const chatEvents = eventsByChat.get(chat.id) ?? [];
      // Group by (stage, provider, model) — the same stage can show more than one model if it
      // was reconfigured mid-chat, and that's exactly the kind of thing worth surfacing here.
      const byStageModel = new Map<string, { stage: UsageStage; provider: string; model: string; events: UsageEvent[] }>();
      for (const e of chatEvents) {
        const key = `${e.stage}::${e.provider}::${e.model}`;
        if (!byStageModel.has(key)) byStageModel.set(key, { stage: e.stage, provider: e.provider, model: e.model, events: [] });
        byStageModel.get(key)!.events.push(e);
      }
      const stages = [...byStageModel.values()]
        .map(({ stage, provider, model, events: stageEvents }) => ({ stage, provider, model, totals: sumEvents(stageEvents, pricing) }))
        .sort((a, b) => (b.totals.cost ?? 0) - (a.totals.cost ?? 0));
      return { chatId: chat.id, title: chat.title, messageCount: chat.messageCount, totals: sumEvents(chatEvents, pricing), stages };
    });
  }, [chats, eventsByChat, pricing]);

  const sortedRows = useMemo(
    () =>
      [...chatRows].sort(
        (a, b) =>
          (b.totals.cost ?? 0) - (a.totals.cost ?? 0) ||
          b.totals.promptTokens + b.totals.completionTokens - (a.totals.promptTokens + a.totals.completionTokens),
      ),
    [chatRows],
  );

  const activeRows = sortedRows.filter((r) => r.totals.promptTokens + r.totals.completionTokens > 0);
  const idleRows = sortedRows.filter((r) => r.totals.promptTokens + r.totals.completionTokens === 0);

  const grandTotal = useMemo(() => sumEvents(events ?? [], pricing), [events, pricing]);
  const maxCost = Math.max(1e-9, ...activeRows.map((r) => r.totals.cost ?? 0));

  function toggle(chatId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      return next;
    });
  }

  if (!events) return <p className="text-text-muted">{t("common.state.loading")}</p>;

  return (
    <div>
      <PageHeader
        icon={Coins}
        title={t("chrome.modal.usage")}
        description={t("usage.description")}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <StatTile icon={TrendingUp} label={t("usage.stats.inputTokens")} value={formatTokens(grandTotal.promptTokens)} />
        <StatTile icon={TrendingDown} label={t("usage.stats.outputTokens")} value={formatTokens(grandTotal.completionTokens)} />
        <StatTile icon={Coins} label={t("usage.stats.totalCost")} value={formatCost(grandTotal.cost)} accent />
        <StatTile icon={MessageSquare} label={t("usage.stats.chatsWithUsage")} value={`${activeRows.length} / ${chats.length}`} />
      </div>

      {grandTotal.hasUnknownPricing && (
        <p className="mb-4 text-xs text-text-faint">{t("usage.unknownPricing")}</p>
      )}

      <div className="rounded-xl border border-border bg-bg-elevated">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">{t("usage.byChat.title")}</p>
          <p className="text-[11px] text-text-faint">{t("usage.byChat.sortedByCost")}</p>
        </div>

        {activeRows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-text-muted">{t("usage.byChat.empty")}</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {activeRows.map((row) => {
              const isOpen = expanded.has(row.chatId);
              const cost = row.totals.cost ?? 0;
              const barPct = Math.max(2, (cost / maxCost) * 100);
              return (
                <div key={row.chatId}>
                  <button
                    onClick={() => toggle(row.chatId)}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-hover"
                  >
                    {isOpen ? <ChevronDown size={14} className="shrink-0 text-text-faint" /> : <ChevronRight size={14} className="shrink-0 text-text-faint" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">{row.title || t("chrome.library.noTitle")}</p>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated-2">
                        <div className="h-full rounded-full bg-accent-2" style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-accent-2">{formatCost(row.totals.cost)}</p>
                      <p className="text-[11px] text-text-faint">{formatTokens(row.totals.promptTokens + row.totals.completionTokens)} {t("usage.unit.tokens")}</p>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border bg-bg px-4 py-3 pl-10">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-text-faint">
                            <th className="pb-1.5 font-normal">{t("usage.table.stage")}</th>
                            <th className="pb-1.5 font-normal">{t("usage.table.model")}</th>
                            <th className="pb-1.5 font-normal">{t("usage.table.input")}</th>
                            <th className="pb-1.5 font-normal">{t("usage.table.output")}</th>
                            <th className="pb-1.5 font-normal">{t("usage.table.cost")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.stages.map(({ stage, provider, model, totals }) => (
                            <tr key={`${stage}::${provider}::${model}`} className="border-t border-border/50">
                              <td className="py-1.5 text-text">{t(STAGE_LABEL_KEYS[stage])}</td>
                              <td className="py-1.5 font-mono text-[11px] text-text-muted">
                                {model || "—"} <span className="text-text-faint">· {provider}</span>
                              </td>
                              <td className="py-1.5 text-text-muted">{formatTokens(totals.promptTokens)}</td>
                              <td className="py-1.5 text-text-muted">{formatTokens(totals.completionTokens)}</td>
                              <td className="py-1.5 text-accent-2">{formatCost(totals.cost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {idleRows.length > 0 && (
          <div className="border-t border-border px-4 py-2.5">
            <button
              onClick={() => setShowAllChats((v) => !v)}
              className="flex cursor-pointer items-center gap-1 text-xs text-text-faint hover:text-text-muted"
            >
              {showAllChats ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {idleRows.length} {t("usage.byChat.idleCount", { count: idleRows.length })}
            </button>
            {showAllChats && (
              <ul className="mt-2 flex flex-col gap-1">
                {idleRows.map((row) => (
                  <li key={row.chatId} className="truncate text-xs text-text-faint">
                    {row.title || t("chrome.library.noTitle")} <span className="text-text-faint/70">· {row.messageCount} {t("usage.byChat.messages")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {globalEvents.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-bg-elevated px-4 py-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-faint">{t("usage.global.title")}</p>
          <p className="text-[11px] text-text-faint">{t("usage.global.hint")}</p>
          <table className="mt-2 w-full text-xs">
            <thead>
              <tr className="text-left text-text-faint">
                <th className="pb-1.5 font-normal">{t("usage.table.stage")}</th>
                <th className="pb-1.5 font-normal">{t("usage.table.model")}</th>
                <th className="pb-1.5 font-normal">{t("usage.table.input")}</th>
                <th className="pb-1.5 font-normal">{t("usage.table.output")}</th>
                <th className="pb-1.5 font-normal">{t("usage.table.cost")}</th>
              </tr>
            </thead>
            <tbody>
              {globalStages.map(({ stage, provider, model, totals }) => (
                <tr key={`${stage}::${provider}::${model}`} className="border-t border-border/50">
                  <td className="py-1.5 text-text">{t(STAGE_LABEL_KEYS[stage])}</td>
                  <td className="py-1.5 font-mono text-[11px] text-text-muted">
                    {model || "—"} <span className="text-text-faint">· {provider}</span>
                  </td>
                  <td className="py-1.5 text-text-muted">{formatTokens(totals.promptTokens)}</td>
                  <td className="py-1.5 text-text-muted">{formatTokens(totals.completionTokens)}</td>
                  <td className="py-1.5 text-accent-2">{formatCost(totals.cost)}</td>
                </tr>
              ))}
              <tr className="border-t border-border font-medium">
                <td className="py-1.5 text-text" colSpan={2}>
                  {t("usage.table.total")}
                </td>
                <td className="py-1.5 text-text">{formatTokens(globalTotals.promptTokens)}</td>
                <td className="py-1.5 text-text">{formatTokens(globalTotals.completionTokens)}</td>
                <td className="py-1.5 text-accent-2">{formatCost(globalTotals.cost)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
