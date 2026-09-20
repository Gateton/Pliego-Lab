import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

interface Props {
  icon: ComponentType<LucideProps>;
  title: string;
  description: string;
  /** Optional live status/badge shown opposite the title (e.g. "Activa: <nombre>"). */
  actions?: ReactNode;
}

/** Every screen opens with this: what it's called and, in plain words, what it's for. */
export function PageHeader({ icon: Icon, title, description, actions }: Props) {
  return (
    <div className="sg-page-header mb-7 flex items-start gap-4">
      <div className="sg-page-header__icon rounded-lg bg-accent/15 p-2 text-accent">
        <Icon size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-3xl font-semibold text-text">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-muted">{description}</p>
      </div>
      {actions && <div className="shrink-0 pt-1">{actions}</div>}
    </div>
  );
}

/** Consistent max-width/padding wrapper for every non-chat screen. */
export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-4xl">{children}</div>;
}
