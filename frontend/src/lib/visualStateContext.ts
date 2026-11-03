import type { CharacterVisualState, SceneStateLedger } from "../types/imageDirector";

/** Most recently updated characters first; older entries are usually people who left the scene. */
const MAX_CHARACTERS = 8;

/**
 * Hands the Image Director's ledgers to the main model so the prose stays physically consistent:
 * - appearance: current outfit + condition per character (nobody re-dressed by accident, removed
 *   garments not described again, a wet or marked body stays that way);
 * - positions: where each body is and what it touches at the end of the last turn (no characters
 *   teleporting between replies);
 * - objects: what is in play and who holds it (the rope is still on her wrists, the glass is on
 *   the nightstand).
 * Both ledgers are only kept up to date while the Director runs, so `enabled` gates everything.
 * Model-facing, so the wording stays in English.
 */
export function buildVisualStateMacro(
  visualState: Record<string, CharacterVisualState> | undefined,
  enabled: boolean,
  sceneState?: SceneStateLedger,
): string {
  if (!enabled) return "";

  const appearance = Object.entries(visualState ?? {})
    .filter(([name, entry]) => name.trim() && (entry.outfit?.trim() || entry.state?.length))
    .sort(([, a], [, b]) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, MAX_CHARACTERS)
    .map(([name, entry]) => {
      const parts: string[] = [];
      if (entry.outfit?.trim()) parts.push(`wearing: ${entry.outfit.trim()}`);
      if (entry.state?.length) parts.push(`condition: ${entry.state.join(", ")}`);
      return `- ${name}: ${parts.join(" | ")}`;
    });
  const positions = Object.entries(sceneState?.positions ?? {})
    .filter(([name, position]) => name.trim() && position.trim())
    .map(([name, position]) => `- ${name}: ${position.trim()}`);
  const objects = (sceneState?.objects ?? []).filter((object) => object.trim()).map((object) => `- ${object.trim()}`);

  if (!appearance.length && !positions.length && !objects.length) return "";

  const sections: string[] = [];
  if (appearance.length) sections.push(`APPEARANCE (clothing and physical condition):\n${appearance.join("\n")}`);
  if (positions.length) sections.push(`POSITIONS (where each body is and what it touches):\n${positions.join("\n")}`);
  if (objects.length) sections.push(`OBJECTS IN PLAY:\n${objects.join("\n")}`);

  return `[CURRENT SCENE — PHYSICAL CONTINUITY]
The physical state of the scene at the end of the last reply. Your reply continues from EXACTLY here.

${sections.join("\n\n")}

Rules:
- Start from these positions. Nobody teleports: if a character changes posture or place (stands up, rolls over, moves to the bed, kneels), show the movement in the prose.
- Respect what bodies can reach from where they are: hands, mouths and contact must make sense for the current positions.
- Never describe a garment that was already removed, never re-dress anyone unless the story does it, and keep conditions (wet, sweaty, flushed, marks, torn clothes) until something changes them.
- Objects stay where they are until someone moves them: a restraint stays on, a held object stays in hand, a dropped garment stays on the floor. Use them when they matter.
- Only the characters actually present in the scene matter; ignore entries for anyone who is not there.`;
}
