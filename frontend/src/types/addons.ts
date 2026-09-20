export interface Addon {
  id: string;
  name: string;
  trigger: string;
  content: string;
  description?: string;
  exclusive?: string;
  rolls?: number;
  builtin?: boolean;
}

export interface AddonsSettings {
  enabled: boolean;
  activeAddonIds: string[];
  addons: Addon[];
}
