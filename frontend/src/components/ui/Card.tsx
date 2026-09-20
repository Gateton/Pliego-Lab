import type { HTMLAttributes, MouseEvent } from "react";

export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`sg-card rounded-lg border border-border bg-bg-elevated p-4 ${className}`}
      {...rest}
    />
  );
}

interface SelectableCardProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  disabled?: boolean;
}

/** A clickable Card whose selected state is a single consistent visual language app-wide. */
export function SelectableCard({ selected = false, disabled = false, className = "", onClick, ...rest }: SelectableCardProps) {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(e as unknown as MouseEvent<HTMLDivElement>);
        }
      }}
      className={`sg-card rounded-lg border p-4 transition-colors duration-150 outline-none
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
        ${
          selected
            ? "border-accent bg-accent/10"
            : "border-border bg-bg-elevated hover:border-border-strong"
        }
        ${className}`}
      {...rest}
    />
  );
}
