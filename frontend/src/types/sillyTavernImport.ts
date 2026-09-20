export interface ScannedCharacter {
  file: string;
  name: string;
}

export interface ScannedPreset {
  file: string;
  name: string;
}

export interface ScannedPersona {
  avatarFile: string;
  name: string;
  description: string;
}

export interface ScannedLorebook {
  file: string;
  name: string;
  entryCount: number;
}

export interface ScanResult {
  characters: ScannedCharacter[];
  presets: ScannedPreset[];
  personas: ScannedPersona[];
  lorebooks: ScannedLorebook[];
  users: string[];
  activeUser: string;
}

export interface ApplyResult {
  importedCharacters: number;
  importedPresets: number;
  importedPersonas: number;
  importedLorebooks: number;
  errors: string[];
}
