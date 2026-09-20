import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-accent text-accent-contrast hover:bg-accent-hover shadow-sm",
  secondary: "bg-bg-elevated-2 text-text border border-border hover:border-border-strong hover:bg-bg-hover",
  ghost: "bg-transparent text-text-muted hover:bg-bg-elevated-2 hover:text-text",
  danger: "bg-transparent text-danger border border-danger/40 hover:bg-danger/10 hover:border-danger/60",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-2.5 py-1 text-sm gap-1.5",
  md: "px-3.5 py-2 text-sm gap-2",
};

export function Button({ variant = "secondary", size = "md", className = "", disabled, ...rest }: Props) {
  return (
    <button
      className={`sg-button sg-button--${variant} inline-flex items-center justify-center rounded-md font-semibold transition-all duration-150
        active:scale-[0.98]
        disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100
        ${disabled ? "" : "cursor-pointer"}
        ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      disabled={disabled}
      {...rest}
    />
  );
}
