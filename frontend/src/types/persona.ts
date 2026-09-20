export interface Persona {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  // Same shape/keys as NpcRecord.values (NpcTrackerSettings.fields) — lets a favorited persona
  // be dropped straight into another chat's NPC roster with no field remapping.
  values?: Record<string, string>;
  lorebookId?: string | null;
}
