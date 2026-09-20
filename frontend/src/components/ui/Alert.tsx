import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

type Kind = "info" | "success" | "warning" | "error";

const KIND_CONFIG: Record<Kind, { icon: typeof Info; classes: string }> = {
  info: { icon: Info, classes: "border-border-strong bg-bg-elevated-2 text-text" },
  success: { icon: CircleCheck, classes: "border-success/40 bg-success/10 text-success" },
  warning: { icon: TriangleAlert, classes: "border-warning/40 bg-warning/10 text-warning" },
  error: { icon: CircleAlert, classes: "border-danger/40 bg-danger/10 text-danger" },
};

export function Alert({ kind = "info", children }: { kind?: Kind; children: ReactNode }) {
  const { icon: Icon, classes } = KIND_CONFIG[kind];
  return (
    <div className={`sg-alert flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${classes}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
