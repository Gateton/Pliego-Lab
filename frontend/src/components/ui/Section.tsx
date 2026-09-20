import type { ReactNode } from "react";

interface Props {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/** A titled card that groups related settings — the building block for every config screen. */
export function Section({ title, description, children, className = "" }: Props) {
  return (
    <section className={`sg-section rounded-lg border border-border bg-bg-elevated p-4 ${className}`}>
      <h3 className="sg-section__title font-display text-sm font-semibold text-text">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-text-faint">{description}</p>}
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}
