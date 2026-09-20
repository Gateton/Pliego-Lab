// Pluma ("Pluma Style") — builds the "## WRITING FORMAT RULES"
// system block from the enabled rules, injected into the main model's prompt.
import type { PlumaSettings } from "../types/pluma";

export function buildPlumaMacro(settings: PlumaSettings | null): string {
  if (!settings?.enabled) return "";
  const active = settings.rules.filter((r) => r.enabled && r.instruction.trim());
  if (active.length === 0) return "";
  const lines = active.map((r) => {
    const line = `- ${r.title.trim()}: ${r.instruction.trim()}`;
    return r.example?.trim() ? `${line} Ex: ${r.example.trim()}` : line;
  });
  return "## WRITING FORMAT RULES\n" + lines.join("\n");
}
