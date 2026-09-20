import { Brain, ExternalLink } from "lucide-react";
import { useT } from "../../i18n";
import { Badge, Button, PageHeader } from "../ui";

interface Props {
  /** True when a chat is open, so the panel can actually be reached. */
  hasActiveChat: boolean;
  onOpenPanel: () => void;
}

/**
 * Entry point for Memoria Viva from the gear menu.
 *
 * The feature itself lives per chat (its ledger belongs to one conversation), so this section
 * explains what it does and jumps to the panel instead of duplicating controls that would have
 * nothing to act on.
 */
export function MemoryOverview({ hasActiveChat, onOpenPanel }: Props) {
  const t = useT();

  return (
    <div>
      <PageHeader
        icon={Brain}
        title={t("settings.memory.title")}
        description={t("settings.memory.description")}
      />

      <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent2">{t("settings.memory.experimental")}</Badge>
          <span className="text-sm font-medium text-text">{t("settings.memory.mayFail")}</span>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
          {t("settings.memory.warning")}
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-bg-elevated p-4">
          <h3 className="font-display text-sm font-semibold text-text">{t("settings.memory.whatYouRemember")}</h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-text-muted">
            <li><strong className="text-text">{t("settings.memory.list.now.label")}</strong> {t("settings.memory.list.now.text")}</li>
            <li><strong className="text-text">{t("settings.memory.list.canon.label")}</strong> {t("settings.memory.list.canon.text")}</li>
            <li><strong className="text-text">{t("settings.memory.list.pending.label")}</strong> {t("settings.memory.list.pending.text")}</li>
            <li><strong className="text-text">{t("settings.memory.list.whoKnows.label")}</strong> {t("settings.memory.list.whoKnows.text")}</li>
            <li><strong className="text-text">{t("settings.memory.list.timeline.label")}</strong> {t("settings.memory.list.timeline.text")}</li>
            <li><strong className="text-text">{t("settings.memory.list.usedInTurn.label")}</strong> {t("settings.memory.list.usedInTurn.text")}</li>
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-bg-elevated p-4">
          <h3 className="font-display text-sm font-semibold text-text">{t("settings.memory.perChat.title")}</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            {t("settings.memory.perChat.bodyPrefix")}{" "}
            <strong className="text-text">{t("settings.memory.perChat.settingsTab")}</strong>{" "}
            {t("settings.memory.perChat.bodySuffix")}
          </p>
          <div className="mt-4">
            {hasActiveChat ? (
              <Button onClick={onOpenPanel}>
                <Brain size={15} />
                {t("settings.memory.openPanel")}
                <ExternalLink size={13} />
              </Button>
            ) : (
              <p className="rounded-md border border-border bg-bg px-3 py-2 text-xs text-text-faint">
                {t("settings.memory.noChat")}
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-lg border border-border bg-bg-elevated p-4">
        <h3 className="font-display text-sm font-semibold text-text">{t("settings.memory.auto.title")}</h3>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-text-muted">
          <li>{t("settings.memory.auto.before")}</li>
          <li>{t("settings.memory.auto.after")}</li>
          <li>{t("settings.memory.auto.edits")}</li>
          <li>{t("settings.memory.auto.guard")}</li>
        </ul>
      </section>
    </div>
  );
}
