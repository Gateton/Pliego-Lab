import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { LeftPanel } from "./LeftPanel";
import { ComfyInjectSettings } from "./settings/ComfyInjectSettings";
import { useComfyInjectSettings } from "../hooks/useComfyInjectSettings";
import { useT } from "../i18n";

export type LeftTab = "respuesta" | "comfyinject";

interface Props {
  onOpenSampling: () => void;
  onCollapse: () => void;
  width: number;
  /** Controlled tab, so the first-run guide can switch to ComfyInject. Uncontrolled when omitted. */
  tab?: LeftTab;
  onTabChange?: (tab: LeftTab) => void;
}

// Wraps LeftPanel ("Respuesta") with a second tab that surfaces ComfyInject's own settings
// (workflow, checkpoint, sampler, LoRAs, estilos) right here — only when ComfyInject is
// enabled — so it doesn't need to be reopened from its full settings modal every time.
export function LeftSidebar({ onOpenSampling, onCollapse, width, tab, onTabChange }: Props) {
  const t = useT();
  const { settings: comfySettings } = useComfyInjectSettings();
  const [uncontrolledTab, setUncontrolledTab] = useState<LeftTab>("respuesta");
  const active = tab ?? uncontrolledTab;
  function setTab(next: LeftTab) {
    if (tab === undefined) setUncontrolledTab(next);
    onTabChange?.(next);
  }
  const comfyAvailable = !!comfySettings?.enabled;
  const activeTab: LeftTab = active === "comfyinject" && !comfyAvailable ? "respuesta" : active;

  return (
    <aside className="workspace-panel workspace-panel--left flex h-full shrink-0 flex-col" style={{ width }} data-tour="left-panel">
      <div className="workspace-panel__header flex shrink-0 items-center justify-between px-2 py-1.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTab("respuesta")}
            data-tour="tab-respuesta"
            className={`cursor-pointer rounded px-2 py-1 font-display text-sm font-semibold transition-colors ${
              activeTab === "respuesta" ? "bg-bg-elevated-2 text-text" : "text-text-muted hover:text-text"
            }`}
          >
            {t("chrome.tabs.response")}
          </button>
          {comfyAvailable && (
            <button
              onClick={() => setTab("comfyinject")}
              data-tour="tab-comfyinject"
              className={`cursor-pointer rounded px-2 py-1 font-display text-sm font-semibold transition-colors ${
                activeTab === "comfyinject" ? "bg-bg-elevated-2 text-text" : "text-text-muted hover:text-text"
              }`}
            >
              {t("chrome.feature.comfyInject")}
            </button>
          )}
        </div>
        <button
          onClick={onCollapse}
          title={t("chrome.panel.hide")}
          aria-label={t("chrome.panel.hide")}
          className="cursor-pointer rounded p-1 text-text-faint transition-colors hover:text-text"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === "respuesta" ? (
          <LeftPanel onOpenSampling={onOpenSampling} />
        ) : (
          <div className="h-full overflow-y-auto p-3">
            <ComfyInjectSettings compact />
          </div>
        )}
      </div>
    </aside>
  );
}
