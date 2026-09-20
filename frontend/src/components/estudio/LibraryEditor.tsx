import type { ReactNode } from "react";
import { useT } from "../../i18n";

interface Props<T extends { id: string }> {
  items: T[]; selectedId: string | null; onSelect: (id: string) => void;
  isActive: (item: T) => boolean; nameOf: (item: T) => string;
  onCreate: () => void; createLabel: string;
  emptyState: { title: string; body: string };
  itemAction?: (item: T) => ReactNode; editor: (item: T) => ReactNode;
}

export function LibraryEditor<T extends { id: string }>(props: Props<T>) {
  const t = useT();
  const { items, selectedId, onSelect, isActive, nameOf, onCreate, createLabel, emptyState, itemAction, editor } = props;
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;
  return (
    <div className="flex min-h-[360px] gap-4">
      <div className="flex w-72 shrink-0 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-bg-elevated p-2">
        {items.map((item) => (
          <div key={item.id} className={`flex items-center gap-1 rounded-md ${item.id === selected?.id ? "bg-accent/12" : "hover:bg-bg-hover"}`}>
            <button onClick={() => onSelect(item.id)} className={`min-w-0 flex-1 px-2.5 py-2 text-left ${item.id === selected?.id ? "text-text" : "text-text-muted"}`}>
              <span className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm font-medium">{nameOf(item)}</span>{isActive(item) && <span className="text-[10px] uppercase text-accent-2">{t("estudio.library.active")}</span>}</span>
            </button>
            {itemAction?.(item)}
          </div>
        ))}
        <button onClick={onCreate} className="mt-1 rounded-md border border-dashed border-border px-2.5 py-2 text-sm text-text-faint hover:bg-bg-hover hover:text-text">+ {createLabel}</button>
      </div>
      {selected ? <div className="min-w-0 flex-1 rounded-lg border border-border bg-bg p-5">{editor(selected)}</div> : <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center"><p className="text-sm text-text">{emptyState.title}</p><p className="mt-1 text-xs text-text-faint">{emptyState.body}</p></div>}
    </div>
  );
}
