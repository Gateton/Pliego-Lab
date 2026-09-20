export type NpcFieldKind = "text" | "textarea" | "tags";

export interface NpcField {
  key: string;
  label: string;
  kind: NpcFieldKind;
  builtin?: boolean;
  // True for fields the Character Card already covers (appearance, personality, role,
  // background, imageTags) — never written for an isMainCharacter NPC entry, so the
  // protagonist's identity never has two competing sources in the same prompt.
  sharedWithCharacterCard?: boolean;
  // How evolveNpcDossiers applies a model-reported update to this field:
  // "append" — the model may only report NEW content to add; the code concatenates it onto
  //   the existing value (tags fields dedupe), so the model can never delete established
  //   permanent facts, no matter how it behaves.
  // "replace" (default when unset, matches pre-existing behavior) — a "current state/snapshot"
  //   field (e.g. current motivation) where the model reports the full new value and it fully
  //   replaces the old one.
  evolveMode?: "append" | "replace";
}

export interface NpcRecord {
  id: string;
  name: string;
  values: Record<string, string>;
  pfp?: string;
  firstSeen?: number;
  // True when this entry is the chat's own {{char}}, included via NpcTrackerSettings.includeMainCharacter.
  isMainCharacter?: boolean;
}

export interface NpcTrackerSettings {
  enabled: boolean;
  autoScan: boolean;
  autoScanInterval: number;
  heuristicScan: boolean;
  includeMainCharacter: boolean;
  evolutionEnabled: boolean;
  evolutionInterval: number;
  model: string;
  fields: NpcField[];
}
