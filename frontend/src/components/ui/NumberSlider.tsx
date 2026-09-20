import { Field, inputClasses } from "./Field";
import { useT } from "../../i18n";

interface Props {
  label: string;
  hint?: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min: number;
  max: number;
  step: number;
  /** When true, an empty number input maps to `undefined` (an optional parameter). */
  optional?: boolean;
  placeholder?: string;
  /** Unit shown after the number input, e.g. "tokens" or "s". */
  suffix?: string;
  className?: string;
}

/**
 * A numeric parameter with both a slider (fast, bounded) and a number input (precise, allows
 * values beyond the slider's range). Used for every generation/provider parameter so they are
 * never number-input-only.
 */
export function NumberSlider({ label, hint, value, onChange, min, max, step, optional, placeholder, suffix, className }: Props) {
  const t = useT();
  const hasValue = value !== undefined && Number.isFinite(value);
  const sliderValue = hasValue ? Math.min(Math.max(value, min), max) : min;

  return (
    <Field label={label} hint={hint} className={className}>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={sliderValue}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 min-w-24 flex-1 cursor-pointer accent-accent"
          aria-label={t("chrome.slider.ariaLabel", { label })}
        />
        {/* Fixed-width wrapper: `inputClasses` carries `w-full`, which would otherwise win over a
            `w-24` utility and stretch the input across the row. */}
        <div className="w-24 shrink-0">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={hasValue ? String(value) : ""}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw.trim() === "") onChange(optional ? undefined : min);
              else onChange(Number(raw));
            }}
            placeholder={placeholder ?? (optional ? t("chrome.slider.notSet") : undefined)}
            className={inputClasses}
          />
        </div>
        {suffix && <span className="shrink-0 text-xs text-text-faint">{suffix}</span>}
      </div>
    </Field>
  );
}
