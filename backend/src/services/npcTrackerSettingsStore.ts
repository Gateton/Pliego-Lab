import type { NpcField, NpcTrackerSettings } from "../types.js";
import { createJsonObjectStore } from "./jsonObjectStore.js";

/** The built-in dossier fields every NPC is scanned for (name is implicit — always the header).
 * evolveMode classifies each as either a cumulative fact ("append" — evolution can only ADD to
 * it, in code, never rewrite it) or a current-state snapshot ("replace" — the model reports the
 * full new value, since the old one is meant to be superseded, not accumulated). */
export const DEFAULT_NPC_FIELDS: NpcField[] = [
  { key: "appearance", label: "Appearance", kind: "textarea", builtin: true, sharedWithCharacterCard: true, evolveMode: "append" },
  { key: "personality", label: "Personality", kind: "textarea", builtin: true, sharedWithCharacterCard: true, evolveMode: "append" },
  { key: "role", label: "Role", kind: "text", builtin: true, sharedWithCharacterCard: true, evolveMode: "replace" },
  { key: "background", label: "Background", kind: "textarea", builtin: true, sharedWithCharacterCard: true, evolveMode: "append" },
  // Portability fields — the point of these is specifically to give a model that has NEVER
  // seen this NPC before (e.g. imported from Favoritos into an unrelated chat) something
  // concrete and actionable to work from, instead of having to infer voice/behavior from
  // "personality" alone.
  { key: "speechStyle", label: "Speaking style", kind: "textarea", builtin: true, evolveMode: "append" },
  { key: "exampleLines", label: "Example lines", kind: "textarea", builtin: true, evolveMode: "append" },
  { key: "motivation", label: "Current motivation", kind: "textarea", builtin: true, evolveMode: "replace" },
  { key: "logline", label: "Summary (one line)", kind: "text", builtin: true, evolveMode: "replace" },
  { key: "defaultStanceToStranger", label: "Stance toward a stranger", kind: "textarea", builtin: true, evolveMode: "replace" },
  { key: "secrets", label: "Secrets", kind: "textarea", builtin: true, evolveMode: "append" },
  { key: "mannerisms", label: "Mannerisms", kind: "textarea", builtin: true, evolveMode: "append" },
  { key: "narrativeLimits", label: "Narrative limits", kind: "textarea", builtin: true, evolveMode: "replace" },
  { key: "imageTags", label: "Image tags", kind: "tags", builtin: true, sharedWithCharacterCard: true, evolveMode: "append" },
];

/** Adds any new builtin field the user's persisted settings predate — without touching their
 * own custom fields or reordering — so upgrading never silently loses a feature behind a
 * "Restaurar campos por defecto" click the user doesn't know to make. Also backfills new
 * PROPERTIES (like sharedWithCharacterCard) onto builtin fields the user already has saved —
 * adding a key here only helps fresh installs, since a persisted field object simply won't
 * have a property that didn't exist when it was written. */
export function mergeMissingBuiltinFields(fields: NpcField[]): NpcField[] {
  const withBackfilledProps = fields.map((f) => {
    if (!f.builtin) return f;
    const current = DEFAULT_NPC_FIELDS.find((d) => d.key === f.key);
    if (!current) return f;
    const needsSharedBackfill = f.sharedWithCharacterCard !== current.sharedWithCharacterCard;
    const needsEvolveModeBackfill = f.evolveMode === undefined && current.evolveMode !== undefined;
    if (!needsSharedBackfill && !needsEvolveModeBackfill) return f;
    return {
      ...f,
      sharedWithCharacterCard: current.sharedWithCharacterCard,
      ...(needsEvolveModeBackfill ? { evolveMode: current.evolveMode } : {}),
    };
  });

  const existingKeys = new Set(withBackfilledProps.map((f) => f.key));
  const missing = DEFAULT_NPC_FIELDS.filter((f) => !existingKeys.has(f.key));
  if (missing.length === 0) return withBackfilledProps;
  const imageTagsIndex = withBackfilledProps.findIndex((f) => f.key === "imageTags");
  if (imageTagsIndex === -1) return [...withBackfilledProps, ...missing];
  return [...withBackfilledProps.slice(0, imageTagsIndex), ...missing, ...withBackfilledProps.slice(imageTagsIndex)];
}

const DEFAULT_SETTINGS: NpcTrackerSettings = {
  enabled: false,
  autoScan: false,
  autoScanInterval: 5,
  heuristicScan: false,
  includeMainCharacter: false,
  evolutionEnabled: false,
  evolutionInterval: 20,
  model: "",
  fields: DEFAULT_NPC_FIELDS,
};

const store = createJsonObjectStore<NpcTrackerSettings>("npcTrackerSettings.json", DEFAULT_SETTINGS);

export async function getNpcTrackerSettings(): Promise<NpcTrackerSettings> {
  const settings = await store.get();
  return { ...settings, fields: mergeMissingBuiltinFields(settings.fields ?? DEFAULT_NPC_FIELDS) };
}

export const updateNpcTrackerSettings = store.update;
