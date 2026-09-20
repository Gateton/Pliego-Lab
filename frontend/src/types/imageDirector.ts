// Image Director — a secondary model that reads the main model's output and inserts
// [[IMG:...]] tags at narratively appropriate moments. ComfyInject then renders them.

export interface ImageDirectorSettings {
  enabled: boolean;
  model: string;                    // OpenRouter model ID for the Director
  maxImagesPerTurn: number;         // max images per response (1-10)
  instructionPrompt: string;        // user instructions for the Director
  jailbreakEnabled: boolean;        // whether the JAILBREAK prompt is sent
  jailbreakPrompt: string;          // final priority instructions for the Director
  triggerMode: "auto" | "manual";   // auto = every response, manual = button

  // Context toggles — what the Director sees besides the text
  includeCharacterContext: boolean;  // send character card (appearance, personality)
  includePersonaContext: boolean;    // send the active persona's dossier imageTags
  contextDepth: number;              // how many previous messages to include (0-20)

  // Sampling / reasoning
  temperature: number;              // determinism (0-2)
  top_p: number;                    // nucleus sampling (0-1)
  max_tokens: number;               // output cap (cost control)
  thinkingEffort: "off" | "auto" | "low" | "medium" | "high";
  minTagsPerImage: number;          // 0 = no minimum enforced; otherwise a hard floor on tags per [[IMG:...]]
  directorTimeoutSeconds: number;   // how long the frontend waits for a Director call before giving up (can be cancelled manually sooner)
}

export interface VisualStateHistoryEntry {
  timestamp: number;
  summary: string;
}

export interface CharacterVisualState {
  outfit: string;
  state: string[];
  updatedAt: number;
  history?: VisualStateHistoryEntry[];
}

export interface DirectorStateUpdate {
  character: string;
  outfitChanged: boolean;
  newOutfit?: string;
  stateAdded?: string[];
  stateRemoved?: string[];
}

export interface DirectorDiagnostic {
  response: string;
  reasoning: string;
}

export const DEFAULT_IMAGE_DIRECTOR_SETTINGS: ImageDirectorSettings = {
  enabled: false,
  model: "",
  maxImagesPerTurn: 3,
  instructionPrompt: "",
  jailbreakEnabled: false,
  jailbreakPrompt: "",
  triggerMode: "manual",
  includeCharacterContext: true,
  includePersonaContext: false,
  contextDepth: 5,
  temperature: 0.4,
  top_p: 1,
  max_tokens: 2000,
  thinkingEffort: "auto",
  minTagsPerImage: 0,
  directorTimeoutSeconds: 240,
};

export const DEFAULT_DIRECTOR_SYSTEM_PROMPT = `WHEN to insert:
- Emotional moment → CLOSE on face
- Action/combat → MEDIUM or DUTCH
- Character described → MEDIUM or CLOSE
- Scenery change → LANDSCAPE + location details
- Power dynamic → LOWANGLE or HIGHANGLE

WHEN NOT to insert:
- Pure dialogue with no visual action
- Internal thoughts without physical manifestation
- Narrative transitions

Example additional instructions you can add:
"Prefer CLOSE in emotional moments. Use MEDIUM for action. Tags should include the scene's lighting and atmosphere. Maximum 3 images per turn."`;
