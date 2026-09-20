import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useT } from "../i18n";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

/** Full-screen overlay for deep-config screens (Roleplay, ComfyInject, Recast, etc.). */
export function ConfigOverlay({ title, onClose, children, wide = false }: Props) {
  const t = useT();
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="config-overlay fixed inset-0 z-50 flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label={title}>
      <div className="config-overlay__header flex h-12 shrink-0 items-center justify-between border-b border-border bg-bg-elevated px-4">
        <h2 className="font-display text-base font-semibold text-text">{title}</h2>
        <button
          onClick={onClose}
          aria-label={t("common.actions.close")}
          className="cursor-pointer rounded-md p-1.5 text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-text"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className={`config-overlay__content mx-auto p-6 ${wide ? "config-overlay__content--wide" : "max-w-4xl"}`}>{children}</div>
      </div>
    </div>
  );
}
