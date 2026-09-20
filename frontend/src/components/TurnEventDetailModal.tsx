import type { TurnEventDetail } from "../types/chat";
import { useT } from "../i18n";
import type { TranslationKey } from "../i18n";
import { Modal } from "./ui";

/** Kind → catalog key, spelled out so the keys stay type-checked against the Spanish catalog. */
const KIND_TITLE_KEYS: Record<TurnEventDetail["kind"], TranslationKey> = {
  npc_added: "chat.turnEvent.title.npcAdded",
  npc_evolved: "chat.turnEvent.title.npcEvolved",
  visual_state: "chat.turnEvent.title.visualState",
};

export function TurnEventDetailModal({ detail, onClose }: { detail: TurnEventDetail; onClose: () => void }) {
  const t = useT();
  return (
    <Modal title={detail.npcName ? `${t(KIND_TITLE_KEYS[detail.kind])} — ${detail.npcName}` : t(KIND_TITLE_KEYS[detail.kind])} onClose={onClose}>
      {detail.changes.length === 0 ? (
        <p className="text-sm text-text-muted">{t("chat.turnEvent.empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {detail.changes.map((c) => (
            <div key={c.key} className="rounded-md border border-border bg-bg p-3">
              <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">{c.label}</p>
              {c.before && (
                <p className="whitespace-pre-wrap text-sm text-text-faint line-through decoration-danger/50">{c.before}</p>
              )}
              {c.after && <p className="whitespace-pre-wrap text-sm text-text">{c.after}</p>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
