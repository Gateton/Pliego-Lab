import type { ReactNode } from "react";

type Tone = "accent" | "accent2" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  accent: "bg-accent/15 text-accent",
  accent2: "bg-accent-2/15 text-accent-2",
  neutral: "bg-bg-elevated-2 text-text-muted",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`sg-badge inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}
