interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * A real <input type="checkbox"> styled as a switch — keeps native semantics
 * (keyboard, screen readers, form behavior) instead of faking one with onClick handlers.
 */
export function Toggle({ checked, onChange, label, hint, disabled, id, className = "" }: Props) {
  const input = (
    <span className="sg-toggle relative inline-flex h-5 w-9 shrink-0 items-center">
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none rounded-full
          border border-border-strong bg-bg-elevated-2 outline-none transition-colors duration-150
          checked:border-accent checked:bg-accent
          disabled:cursor-not-allowed disabled:opacity-40"
      />
      <span
        className="pointer-events-none absolute left-0.5 h-4 w-4 rounded-full bg-text-muted shadow-sm transition-transform duration-150
          peer-checked:translate-x-4 peer-checked:bg-accent-contrast"
      />
    </span>
  );

  if (!label) return <span className={className}>{input}</span>;

  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2.5 ${disabled ? "cursor-not-allowed" : "cursor-pointer"} ${className}`}
    >
      {input}
      <span className="flex flex-col">
        <span className="text-sm text-text">{label}</span>
        {hint && <span className="text-xs text-text-faint">{hint}</span>}
      </span>
    </label>
  );
}
