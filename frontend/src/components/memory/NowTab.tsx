import {
  BookOpenCheck,
  Clock3,
  ListTodo,
  MapPin,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import type { SceneState } from "../../types/activeMemory";
import { useT } from "../../i18n";
import { Alert } from "../ui";
import { EmptySection, EvidenceList } from "./memoryBits";
import { formatDate, textValue } from "./memoryFormat";

interface Props {
  scene?: SceneState;
  onGoToMessage?: (messageId: string) => void;
}

const KNOWN_KEYS = new Set([
  "location", "narrativeTime", "presentCharacterIds", "positions", "relevantObjects", "immediateGoal",
  "pendingAction", "tone", "tension", "lastSignificantChange", "evidenceMessageIds", "updatedAt",
]);

export function NowTab({ scene, onGoToMessage }: Props) {
  const t = useT();
  const rows = [
    { icon: MapPin, label: t("memory.now.location"), value: scene?.location },
    { icon: Clock3, label: t("memory.now.narrativeTime"), value: scene?.narrativeTime },
    { icon: Users, label: t("memory.now.present"), value: scene?.presentCharacterIds },
    { icon: Target, label: t("memory.now.immediateGoal"), value: scene?.immediateGoal },
    { icon: ListTodo, label: t("memory.now.pendingAction"), value: scene?.pendingAction },
    { icon: Sparkles, label: t("memory.now.tone"), value: [scene?.tone, scene?.tension].filter(Boolean) },
    { icon: BookOpenCheck, label: t("memory.now.relevantObjects"), value: scene?.relevantObjects },
  ].map((row) => ({ ...row, text: textValue(row.value) })).filter((row) => row.text);

  // Positions are a per-character map, so they get their own readable rendering instead of being
  // flattened into a comma list.
  const positions = Object.entries(scene?.positions ?? {}).filter(([, value]) => value?.trim());
  const extraRows = Object.entries(scene ?? {})
    .filter(([key]) => !KNOWN_KEYS.has(key))
    .map(([key, value]) => ({ key, text: textValue(value) }))
    .filter((row): row is { key: string; text: string } => Boolean(row.text));
  const evidence = scene?.evidenceMessageIds ?? [];

  if (rows.length === 0 && extraRows.length === 0 && positions.length === 0 && evidence.length === 0) {
    return (
      <EmptySection
        icon={MapPin}
        title={t("memory.now.emptyTitle")}
        body={t("memory.now.emptyBody")}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map(({ icon: Icon, label, text }) => (
          <div key={label} className="rounded-lg border border-border bg-bg p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-faint">
              <Icon size={14} />
              <span>{label}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-text">{text}</p>
          </div>
        ))}
      </div>
      {positions.length > 0 && (
        <div className="rounded-lg border border-border bg-bg p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-text-faint">
            <Users size={14} />
            <span>{t("memory.now.positions")}</span>
          </div>
          {positions.map(([name, value]) => (
            <div key={name} className="grid gap-1 py-1 md:grid-cols-[10rem_1fr]">
              <span className="text-xs font-semibold text-text-faint">{name}</span>
              <span className="text-sm text-text">{value}</span>
            </div>
          ))}
        </div>
      )}
      {extraRows.length > 0 && (
        <div className="rounded-lg border border-border bg-bg p-4">
          {extraRows.map((row) => (
            <div key={row.key} className="grid gap-1 py-2 first:pt-0 last:pb-0 md:grid-cols-[10rem_1fr]">
              <span className="text-xs font-semibold capitalize text-text-faint">{row.key.replaceAll("_", " ")}</span>
              <span className="text-sm text-text">{row.text}</span>
            </div>
          ))}
        </div>
      )}
      {scene?.lastSignificantChange && (
        <Alert kind="info"><strong>{t("memory.now.lastChange")}</strong> {scene.lastSignificantChange}</Alert>
      )}
      {(evidence.length > 0 || scene?.updatedAt) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg px-4 py-3">
          <EvidenceList ids={evidence} onGoToMessage={onGoToMessage} />
          {scene?.updatedAt && <span className="text-xs text-text-faint">{t("memory.now.updated", { date: formatDate(scene.updatedAt) ?? "" })}</span>}
        </div>
      )}
    </div>
  );
}
