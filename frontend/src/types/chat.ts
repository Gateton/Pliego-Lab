import type { GeneratedImageResult } from "./comfyInject";
import type { NpcRecord } from "./npcTracker";
import type { CharacterVisualState } from "./imageDirector";

export interface TurnEventChange {
  key: string;
  label: string;
  before: string;
  after: string;
}

export interface TurnEventDetail {
  kind: "npc_added" | "npc_evolved" | "visual_state";
  npcName?: string;
  changes: TurnEventChange[];
}

export interface TurnEvent {
  text: string;
  detail?: TurnEventDetail;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  swipes: string[];
  activeSwipeIndex: number;
  createdAt: number;
  images?: Record<string, GeneratedImageResult>;
  recast?: RecastData;
  reasonings?: string[];
  personaAvatar?: string;
  // Permanent log of automatic background events tied to this turn (new NPC detected, an NPC
  // evolved, a visual-state change) — a record the user can scroll back to, never auto-cleared.
  // Array entries can be a bare string (older/legacy events, before per-field detail existed) or
  // a TurnEvent (current shape) — always normalize with a typeof check before rendering.
  events?: Array<string | TurnEvent>;
}

export interface RecastData {
  prefix: string;
  original: string;
  transformed: string;
  snapshots: string[];
  passNames: string[];
}

export interface Chat {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  characterId: string | null;
  personaId: string | null;
  messages: ChatMessage[];
  extensionData?: Record<string, unknown>;
  npcs?: NpcRecord[];
  npcTracker?: { lastScannedCount: number; lastEvolvedCount?: number };
  variables?: Record<string, string>;
  visualState?: Record<string, CharacterVisualState>;
}

export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: number;
  characterId: string | null;
  messageCount: number;
  lastMessagePreview: string;
}
