import type { ReactNode } from "react";

interface Props {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

/** Consistent label + control + helper-text layout, used for every form field in the app. */
export function Field({ label, hint, error, htmlFor, children, className = "" }: Props) {
  return (
    <div className={`sg-field flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-text">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-text-faint">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export const inputClasses =
  "sg-input w-full rounded-md border border-border bg-bg-elevated-2 px-3 py-2 text-sm text-text placeholder:text-text-faint " +
  "outline-none transition-colors focus:border-accent";

export const textareaClasses = `${inputClasses} resize-y`;
