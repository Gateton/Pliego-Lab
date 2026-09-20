import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { t, useT } from "../../i18n";
import type { ModelDescriptor } from "../../types/provider";
import { inputClasses } from "../ui";
import { compareText } from "../../i18n";

type SortBy = "alpha" | "price" | "context";

interface Props {
  models: ModelDescriptor[];
  value: string;
  onChange: (modelId: string) => void;
  placeholder?: string;
}

function promptPricePerMillion(model: ModelDescriptor): number | null {
  if (!model.pricing) return null;
  return model.pricing.prompt * 1_000_000;
}

/** Copy lives in the catalog, so it is resolved when the row is rendered, not when the module loads. */
function formatPrice(model: ModelDescriptor): string | null {
  const price = promptPricePerMillion(model);
  if (price === null) return null;
  if (price <= 0) return t("settings.models.free");
  return t("settings.models.pricePerMillion", { price: price.toFixed(2) });
}

function formatContext(model: ModelDescriptor): string | null {
  if (!model.contextLength) return null;
  if (model.contextLength >= 1000) return t("settings.models.contextK", { tokens: Math.round(model.contextLength / 1000) });
  return t("settings.models.contextTokens", { tokens: model.contextLength });
}

function vendorOf(modelId: string): string {
  return modelId.split("/")[0] ?? modelId;
}

export function ModelSelect({ models, value, onChange, placeholder }: Props) {
  const t = useT();
  const [sortBy, setSortBy] = useState<SortBy>("alpha");
  const [groupByVendor, setGroupByVendor] = useState(true);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = models.find((m) => m.id === value) ?? null;

  const sorted = useMemo(() => {
    const copy = [...models];
    if (sortBy === "alpha") copy.sort((a, b) => compareText(a.name, b.name));
    else if (sortBy === "price") copy.sort((a, b) => (promptPricePerMillion(a) ?? Infinity) - (promptPricePerMillion(b) ?? Infinity));
    else if (sortBy === "context") copy.sort((a, b) => (b.contextLength ?? 0) - (a.contextLength ?? 0));
    return copy;
  }, [models, sortBy]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
  }, [sorted, query]);

  const groups = useMemo(() => {
    if (!groupByVendor) return [{ vendor: null as string | null, models: filtered }];
    const byVendor = new Map<string, ModelDescriptor[]>();
    for (const m of filtered) {
      const vendor = vendorOf(m.id);
      if (!byVendor.has(vendor)) byVendor.set(vendor, []);
      byVendor.get(vendor)!.push(m);
    }
    return Array.from(byVendor.entries()).map(([vendor, vendorModels]) => ({ vendor, models: vendorModels }));
  }, [filtered, groupByVendor]);

  const flatList = useMemo(() => groups.flatMap((g) => g.models), [groups]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectModel(m: ModelDescriptor) {
    onChange(m.id);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      e.currentTarget.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, flatList.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const typed = query.trim();
      const exact = flatList.find((m) => m.id.toLowerCase() === typed.toLowerCase());
      if (exact) selectModel(exact);
      // Enter on a typed id that isn't in the list accepts it as a custom model — needed for
      // providers without a model-list endpoint (Azure deploys, custom gateways).
      else if (typed) {
        onChange(typed);
        setOpen(false);
        setQuery("");
      } else {
        const m = flatList[highlight];
        if (m) selectModel(m);
      }
    }
  }

  const selectedLabel = selected
    ? [selected.name, formatContext(selected), formatPrice(selected)].filter(Boolean).join(" — ")
    : "";

  return (
    <div ref={containerRef} className="relative flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className={`${inputClasses} w-auto!`}>
          <option value="alpha">{t("settings.models.sortAlpha")}</option>
          <option value="price">{t("settings.models.sortPrice")}</option>
          <option value="context">{t("settings.models.sortContext")}</option>
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-text-muted">
          <input type="checkbox" checked={groupByVendor} onChange={(e) => setGroupByVendor(e.target.checked)} className="accent-accent" />
          {t("settings.models.groupByVendor")}
        </label>
      </div>

      <input
        value={open ? query : selectedLabel}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? t("settings.models.searchPlaceholder")}
        className={inputClasses}
      />

      {open && (
        <div className="absolute top-full z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-bg-elevated shadow-xl">
          {flatList.length === 0 && (
            <p className="px-3 py-2 text-sm text-text-faint">
              {query.trim() ? t("settings.models.enterToUse", { query: query.trim() }) : t("settings.models.noResults")}
            </p>
          )}
          {groups.map((group) => (
            <div key={group.vendor ?? "_all"}>
              {group.vendor && (
                <div className="sticky top-0 bg-bg-elevated px-3 py-1 text-xs font-semibold uppercase tracking-wide text-text-faint">
                  {group.vendor}
                </div>
              )}
              {group.models.map((m) => {
                const flatIndex = flatList.indexOf(m);
                const meta = [formatContext(m), formatPrice(m)].filter(Boolean).join(" — ");
                return (
                  <button
                    key={m.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectModel(m)}
                    className={`block w-full cursor-pointer px-3 py-2 text-left text-sm transition-colors
                      ${flatIndex === highlight ? "bg-accent/15 text-accent" : "text-text hover:bg-bg-elevated-2"}`}
                  >
                    {m.name} {meta && <span className="text-text-faint">— {meta}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
