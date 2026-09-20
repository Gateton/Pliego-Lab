import { Blocks } from "lucide-react";
import { RulesPanel } from "./RulesPanel";
import { useT } from "../../i18n";

const SECTIONS = [{ id: "reglas", labelKey: "estudio.rules.title", icon: Blocks }] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/**
 * Estudio — how the story is written and played. Two independent prompt layers, each with its
 * own library, kept out of the provider/preset configuration on purpose.
 */
export function EstudioPanel() {
  const t = useT();
  const active: SectionId = "reglas";

  return (
    <div>
      <div role="tablist" aria-label={t("estudio.panel.sections")} className="mb-6 inline-flex rounded-lg border border-border bg-bg-elevated p-1">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const selected = section.id === active;
          return (
            <button
              key={section.id}
              role="tab"
              aria-selected={selected}
              onClick={() => undefined}
              className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
                selected ? "bg-accent/15 text-text" : "text-text-muted hover:bg-bg-hover hover:text-text"
              }`}
            >
              <Icon size={15} />
              {t(section.labelKey)}
            </button>
          );
        })}
      </div>

      {active === "reglas" && <RulesPanel />}
    </div>
  );
}
