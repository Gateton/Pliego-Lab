export interface RecastPass {
  id: string;
  name: string;
  enabled: boolean;
  contextLength: number;
  prompt: string;
  model?: string;
  includeCharCard: boolean;
  includeSceneContext: boolean;
}

export interface RecastPreset {
  id: string;
  name: string;
  passes: RecastPass[];
}

export interface RecastSettings {
  enabled: boolean;
  autoRun: boolean;
  activePresetId: string | null;
  minChars: number;
  sceneContextAsRoles: boolean;
}
