interface Tab {
  id: string;
  label: string;
}

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, active, onChange }: Props) {
  return (
    <div role="tablist" className="sg-tabs flex flex-wrap gap-1 border-b border-border">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`sg-tab cursor-pointer border-b-2 px-3 py-2 text-sm font-semibold transition-colors
              ${isActive ? "border-accent text-text" : "border-transparent text-text-muted hover:border-border-strong hover:text-text"}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
