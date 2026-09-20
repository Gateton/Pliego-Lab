import { Eye, Users } from "lucide-react";
import { useMemo } from "react";
import type { ActiveMemoryState, MemoryFact } from "../../types/activeMemory";
import { useT } from "../../i18n";
import { Alert } from "../ui";
import { EmptySection, KnowledgeTick } from "./memoryBits";
import { useMemoryAction } from "./memoryAction";
import { factSentence, toggleVisibleTo } from "./memoryFormat";
import type { MemoryFactPatch } from "./panelTypes";

interface Props {
  memory: ActiveMemoryState;
  knownNames: string[];
  savingIds: Set<string>;
  onUpdateFact?: (id: string, patch: MemoryFactPatch) => Promise<void>;
}

function truncated(value: string, max = 52): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function KnowledgeTab({ memory, knownNames, savingIds, onUpdateFact }: Props) {
  const t = useT();
  const action = useMemoryAction(onUpdateFact);

  // Rows are the union of the names the host knows about and every name already stored in the
  // contract, so a fact that lists an unknown id still shows up as its own row.
  const names = useMemo(() => {
    const seen = new Set<string>();
    const next: string[] = [];
    const push = (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      next.push(trimmed);
    };
    knownNames.forEach(push);
    memory.facts.forEach((fact) => {
      if (fact.visibleTo !== "all") fact.visibleTo.forEach(push);
    });
    return next;
  }, [knownNames, memory.facts]);

  const facts = memory.facts;

  if (memory.facts.length === 0) {
    return (
      <EmptySection
        icon={Eye}
        title={t("memory.knowledge.emptyFactsTitle")}
        body={t("memory.knowledge.emptyFactsBody")}
      />
    );
  }

  if (names.length === 0) {
    return (
      <EmptySection
        icon={Users}
        title={t("memory.knowledge.emptyNamesTitle")}
        body={t("memory.knowledge.emptyNamesBody")}
      />
    );
  }

  function knows(fact: MemoryFact, name: string): boolean {
    return fact.visibleTo === "all" || fact.visibleTo.includes(name);
  }

  function isLastWitness(fact: MemoryFact, name: string): boolean {
    if (fact.visibleTo === "all") return false;
    return fact.visibleTo.length === 1 && fact.visibleTo[0] === name;
  }

  async function toggle(fact: MemoryFact, name: string) {
    if (isLastWitness(fact, name)) return;
    await action.run(fact.id, { visibleTo: toggleVisibleTo(fact.visibleTo, name, names) });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-text-faint">
        {t("memory.knowledge.intro")}
      </p>
      {action.error && <Alert kind="error">{action.error}</Alert>}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-max border-collapse text-sm">
          <caption className="sr-only">{t("memory.knowledge.caption")}</caption>
          <thead>
            <tr className="bg-bg-elevated-2">
              <th scope="col" className="sticky left-0 z-10 bg-bg-elevated-2 px-3 py-2 text-left text-xs font-semibold text-text-faint">
                {t("memory.knowledge.character")}
              </th>
              {facts.map((fact, index) => {
                const knowers = names.filter((name) => knows(fact, name)).length;
                return (
                  <th key={fact.id} scope="col" className="border-l border-border px-2 py-2 text-left align-bottom">
                    <span className="flex w-36 flex-col gap-1">
                      <span className="text-[11px] font-normal leading-snug text-text-muted" title={factSentence(fact)}>
                        <span className="font-mono text-text-faint">#{index + 1} </span>
                        {truncated(factSentence(fact))}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-text-faint">
                        {fact.visibleTo === "all" ? t("memory.shared.everyone") : t("memory.knowledge.knows", { count: knowers })}
                      </span>
                    </span>
                  </th>
                );
              })}
              <th scope="col" className="border-l border-border px-3 py-2 text-left text-xs font-semibold text-text-faint">
                {t("memory.knowledge.remembers")}
              </th>
            </tr>
          </thead>
          <tbody>
            {names.map((name) => {
              const known = facts.filter((fact) => knows(fact, name)).length;
              return (
                <tr key={name} className="border-t border-border">
                  <th scope="row" className="sticky left-0 z-10 bg-bg px-3 py-2 text-left text-xs font-semibold text-text">
                    {name}
                  </th>
                  {facts.map((fact) => {
                    const checked = knows(fact, name);
                    const lastWitness = isLastWitness(fact, name);
                    const saving = savingIds.has(`fact:${fact.id}`);
                    return (
                      <td key={fact.id} className="border-l border-border px-2 py-2 text-center">
                        <KnowledgeTick
                          checked={checked}
                          disabled={action.busy || saving || lastWitness}
                          label={lastWitness
                            ? t("memory.knowledge.lastWitnessTitle", { name, fact: factSentence(fact) })
                            : checked
                              ? t("memory.knowledge.revokeFrom", { name, fact: factSentence(fact) })
                              : t("memory.knowledge.grantTo", { name, fact: factSentence(fact) })}
                          onClick={() => void toggle(fact, name)}
                        />
                      </td>
                    );
                  })}
                  <td className="border-l border-border px-3 py-2 text-xs text-text-faint">
                    {known}/{facts.length}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
