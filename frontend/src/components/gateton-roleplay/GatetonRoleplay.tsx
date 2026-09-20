import { useState, useEffect } from "react";
import {
  Brain,
  ArrowLeft,
  Feather,
  Globe,
  Scroll,
  Shield,
  Swords,
  Map,
  BookOpen,
  Users,
  Compass,
  X,
  ChevronRight,
  Zap,
  Film,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { useT } from "../../i18n";
import type { TranslationKey } from "../../i18n";
import type { Chat } from "../../types/chat";

// ─── Module definitions ───────────────────────────────────────────────────────

type ModuleCategory = "core" | "world" | "combat" | "narrative" | "visual";

interface ModuleDef {
  id: string;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: ComponentType<LucideProps>;
  color: string;
  glowColor: string;
  category: ModuleCategory;
}

const MODULES: ModuleDef[] = [
  {
    id: "mind",
    labelKey: "roleplay.hub.module.mind.label",
    descriptionKey: "roleplay.hub.module.mind.description",
    icon: Brain,
    color: "#7ea28a",
    glowColor: "rgba(126,162,138,0.3)",
    category: "core",
  },
  {
    id: "pluma",
    labelKey: "roleplay.pluma.title",
    descriptionKey: "roleplay.hub.module.pluma.description",
    icon: Feather,
    color: "#c98a5e",
    glowColor: "rgba(201,138,94,0.3)",
    category: "narrative",
  },
  {
    id: "world",
    labelKey: "roleplay.hub.module.world.label",
    descriptionKey: "roleplay.hub.module.world.description",
    icon: Globe,
    color: "#6f97a9",
    glowColor: "rgba(111,151,169,0.3)",
    category: "world",
  },
  {
    id: "lore",
    labelKey: "roleplay.hub.module.lore.label",
    descriptionKey: "roleplay.hub.module.lore.description",
    icon: Scroll,
    color: "#c9a05a",
    glowColor: "rgba(201,160,90,0.3)",
    category: "world",
  },
  {
    id: "characters",
    labelKey: "roleplay.hub.module.characters.label",
    descriptionKey: "roleplay.hub.module.characters.description",
    icon: Users,
    color: "#9b7ec9",
    glowColor: "rgba(155,126,201,0.3)",
    category: "world",
  },
  {
    id: "combat",
    labelKey: "roleplay.hub.module.combat.label",
    descriptionKey: "roleplay.hub.module.combat.description",
    icon: Swords,
    color: "#c96b58",
    glowColor: "rgba(201,107,88,0.3)",
    category: "combat",
  },
  {
    id: "defense",
    labelKey: "roleplay.hub.module.defense.label",
    descriptionKey: "roleplay.hub.module.defense.description",
    icon: Shield,
    color: "#7faa79",
    glowColor: "rgba(127,170,121,0.3)",
    category: "combat",
  },
  {
    id: "inventory",
    labelKey: "roleplay.hub.module.inventory.label",
    descriptionKey: "roleplay.hub.module.inventory.description",
    icon: Map,
    color: "#a9c97e",
    glowColor: "rgba(169,201,126,0.3)",
    category: "core",
  },
  {
    id: "journal",
    labelKey: "roleplay.hub.module.journal.label",
    descriptionKey: "roleplay.hub.module.journal.description",
    icon: BookOpen,
    color: "#c98a8a",
    glowColor: "rgba(201,138,138,0.3)",
    category: "narrative",
  },
  {
    id: "explore",
    labelKey: "roleplay.hub.module.explore.label",
    descriptionKey: "roleplay.hub.module.explore.description",
    icon: Compass,
    color: "#5e9ac9",
    glowColor: "rgba(94,154,201,0.3)",
    category: "world",
  },
  {
    id: "director",
    labelKey: "roleplay.hub.module.director.label",
    descriptionKey: "roleplay.hub.module.director.description",
    icon: Film,
    color: "#c98a5e",
    glowColor: "rgba(201,138,94,0.3)",
    category: "visual",
  },
];

const CATEGORY_LABEL_KEYS: Record<ModuleCategory, TranslationKey> = {
  core: "roleplay.hub.category.core",
  world: "roleplay.hub.category.world",
  combat: "roleplay.hub.category.combat",
  narrative: "roleplay.hub.category.narrative",
  visual: "roleplay.hub.category.visual",
};

// ─── Module Card ──────────────────────────────────────────────────────────────

interface ModuleCardProps {
  module: ModuleDef;
  isExpanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
}

function ModuleCard({ module, isExpanded, onToggle, children }: ModuleCardProps) {
  const t = useT();
  const Icon = module.icon;

  return (
    <div
      className={`group relative cursor-pointer overflow-hidden rounded-xl border transition-all duration-300 ${
        isExpanded
          ? "col-span-2 row-span-2 border-border-strong"
          : "border-border hover:border-border-strong"
      }`}
      style={{
        background: isExpanded
          ? `linear-gradient(135deg, ${module.glowColor}, transparent 60%)`
          : undefined,
      }}
      onClick={!isExpanded ? onToggle : undefined}
    >
      {/* Glow effect */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${module.glowColor}, transparent 70%)`,
        }}
      />

      <div className="relative z-10 p-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${module.color}20` }}
            >
              <Icon size={18} style={{ color: module.color }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text">{t(module.labelKey)}</h3>
              {!isExpanded && (
                <p className="text-[11px] text-text-faint">{t(module.descriptionKey)}</p>
              )}
            </div>
          </div>

          {isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="cursor-pointer rounded-md p-1.5 text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-text"
            >
              <X size={14} />
            </button>
          )}

          {!isExpanded && (
            <ChevronRight
              size={14}
              className="text-text-faint opacity-0 transition-all duration-200 group-hover:opacity-100"
            />
          )}
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="mt-4">
            <p className="mb-3 text-xs text-text-muted">{t(module.descriptionKey)}</p>
            {children || (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border">
                <p className="text-xs text-text-faint">{t("roleplay.hub.comingSoon")}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Status Bar ───────────────────────────────────────────────────────────────

interface StatusBarProps {
  activeModules: string[];
  onModuleClick: (id: string) => void;
}

function StatusBar({ activeModules, onModuleClick }: StatusBarProps) {
  const t = useT();

  return (
    <div className="flex h-8 shrink-0 items-center gap-1 border-t border-border bg-bg-elevated px-3">
      <Zap size={12} className="text-accent-2" />
      <span className="mr-2 text-[10px] font-medium text-text-faint uppercase tracking-wider">
        {t("roleplay.hub.active")}
      </span>
      {activeModules.length === 0 ? (
        <span className="text-[10px] text-text-faint">{t("roleplay.hub.none")}</span>
      ) : (
        activeModules.map((id) => {
          const mod = MODULES.find((m) => m.id === id);
          if (!mod) return null;
          const Icon = mod.icon;
          return (
            <button
              key={id}
              onClick={() => onModuleClick(id)}
              className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors hover:bg-bg-hover"
              style={{ color: mod.color }}
            >
              <Icon size={10} />
              {t(mod.labelKey)}
            </button>
          );
        })
      )}
    </div>
  );
}

// ─── Dedicated Editor View ────────────────────────────────────────────────────

function DedicatedView({
  title,
  icon: Icon,
  onBack,
  onClose,
  children,
}: {
  title: string;
  icon: ComponentType<LucideProps>;
  onBack: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useT();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-bg-elevated px-4">
        <button
          onClick={onBack}
          className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
        >
          <ArrowLeft size={16} />
          {t("roleplay.hub.back")}
        </button>
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-accent-2" />
          <span className="font-display text-sm font-semibold text-text">{title}</span>
        </div>
        <button
          onClick={onClose}
          aria-label={t("common.actions.close")}
          className="ml-auto cursor-pointer rounded-md p-1.5 text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-text"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  chat: Chat | null;
  onClose: () => void;
}

export function GatetonRoleplay({ chat: _chat, onClose }: Props) {
  const t = useT();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeModules, setActiveModules] = useState<string[]>([]);
  const [view, setView] = useState<"grid" | "pluma" | "director">("grid");

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (view === "pluma" || view === "director") setView("grid");
        else if (expandedId) setExpandedId(null);
        else onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [view, expandedId, onClose]);

  function toggleModule(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function toggleActive(id: string) {
    setActiveModules((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // Group modules by category
  const categories = Array.from(new Set(MODULES.map((m) => m.category)));

  // Dedicated editor views (Estilo de Pluma, Image Director) — navigated to instead of inline expansion.
  if (view === "pluma") {
    return (
      <DedicatedView title={t("roleplay.pluma.title")} icon={Feather} onBack={() => setView("grid")} onClose={onClose}>
        <PlumaModuleContent />
      </DedicatedView>
    );
  }
  if (view === "director") {
    return (
      <DedicatedView title={t("chrome.modal.director")} icon={Film} onBack={() => setView("grid")} onClose={onClose}>
        <DirectorModuleContent />
      </DedicatedView>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label={t("chrome.modal.gatetonRoleplay")}>
      {/* Top bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-bg-elevated px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-2/20">
            <Zap size={14} className="text-accent-2" />
          </div>
          <div>
            <h2 className="font-display text-sm font-semibold text-text">{t("chrome.modal.gatetonRoleplay")}</h2>
            <p className="text-[10px] text-text-faint">{t("roleplay.hub.subtitle")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Active module toggles */}
          {MODULES.filter((m) => activeModules.includes(m.id)).map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => toggleActive(mod.id)}
                className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors"
                style={{
                  backgroundColor: `${mod.color}15`,
                  color: mod.color,
                  border: `1px solid ${mod.color}30`,
                }}
              >
                <Icon size={12} />
                {t(mod.labelKey)}
                <X size={10} className="ml-0.5 opacity-60" />
              </button>
            );
          })}

          <button
            onClick={onClose}
            aria-label={t("common.actions.close")}
            className="cursor-pointer rounded-md p-1.5 text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-text"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl">
          {categories.map((cat) => (
            <div key={cat} className="mb-8">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-text-faint">
                {t(CATEGORY_LABEL_KEYS[cat])}
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {MODULES.filter((m) => m.category === cat).map((mod) => (
                  <div key={mod.id} className="relative">
                    {/* Active indicator */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleActive(mod.id);
                      }}
                      className={`absolute right-2 top-2 z-20 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border transition-all ${
                        activeModules.includes(mod.id)
                          ? "border-transparent"
                          : "border-border bg-bg-elevated hover:border-border-strong"
                      }`}
                      style={
                        activeModules.includes(mod.id)
                          ? { backgroundColor: mod.color, borderColor: mod.color }
                          : undefined
                      }
                      title={activeModules.includes(mod.id) ? t("roleplay.hub.deactivate") : t("roleplay.hub.activate")}
                    >
                      {activeModules.includes(mod.id) && (
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </button>

                    <ModuleCard
                      module={mod}
                      isExpanded={expandedId === mod.id}
                      onToggle={
                        mod.id === "pluma"
                          ? () => setView("pluma")
                          : mod.id === "director"
                            ? () => setView("director")
                            : () => toggleModule(mod.id)
                      }
                    >
                      {/* Module-specific content */}
                      {mod.id === "mind" && <MindModuleContent />}
                      {mod.id === "pluma" && <PlumaModuleContent />}
                      {mod.id === "world" && <WorldModuleContent />}
                      {mod.id === "lore" && <LoreModuleContent />}
                      {mod.id === "characters" && <CharactersModuleContent />}
                      {mod.id === "combat" && <CombatModuleContent />}
                      {mod.id === "defense" && <DefenseModuleContent />}
                      {mod.id === "inventory" && <InventoryModuleContent />}
                      {mod.id === "journal" && <JournalModuleContent />}
                      {mod.id === "explore" && <ExploreModuleContent />}
                    </ModuleCard>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <StatusBar activeModules={activeModules} onModuleClick={toggleModule} />
    </div>
  );
}

// ─── Module Content Placeholders ──────────────────────────────────────────────

function ModulePlaceholder({ labelKey }: { labelKey: TranslationKey }) {
  const t = useT();

  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border bg-bg-elevated/50">
      <div className="text-center">
        <p className="text-xs text-text-faint">{t(labelKey)}</p>
        <p className="mt-1 text-[10px] text-text-faint/60">{t("roleplay.hub.soon")}</p>
      </div>
    </div>
  );
}

function MindModuleContent() {
  return <ModulePlaceholder labelKey="roleplay.hub.placeholder.mind" />;
}

function WorldModuleContent() {
  return <ModulePlaceholder labelKey="roleplay.hub.placeholder.world" />;
}

function LoreModuleContent() {
  return <ModulePlaceholder labelKey="roleplay.hub.placeholder.lore" />;
}

function CharactersModuleContent() {
  return <ModulePlaceholder labelKey="roleplay.hub.placeholder.characters" />;
}

function CombatModuleContent() {
  return <ModulePlaceholder labelKey="roleplay.hub.placeholder.combat" />;
}

function DefenseModuleContent() {
  return <ModulePlaceholder labelKey="roleplay.hub.placeholder.defense" />;
}

function InventoryModuleContent() {
  return <ModulePlaceholder labelKey="roleplay.hub.placeholder.inventory" />;
}

function JournalModuleContent() {
  return <ModulePlaceholder labelKey="roleplay.hub.placeholder.journal" />;
}

function ExploreModuleContent() {
  return <ModulePlaceholder labelKey="roleplay.hub.placeholder.explore" />;
}
import { DirectorModuleContent } from "./modules/DirectorModule";
import { PlumaModuleContent } from "./modules/PlumaModule";
