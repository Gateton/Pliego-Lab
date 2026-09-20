import {
  BookMarked,
  Brain,
  Coins,
  Download,
  Film,
  Image as ImageIcon,
  Images,
  Palette,
  ScanSearch,
  ScrollText,
  SlidersHorizontal,
  Sparkles,
  UserCircle,
  Users,
  Wand2,
  Zap,
} from "lucide-react";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import type { ModalId } from "../../App";
import type { TranslationKey } from "../../i18n";

export interface FeatureEntry {
  id: string;
  nameKey: TranslationKey;
  blurbKey: TranslationKey;
  icon: ComponentType<LucideProps>;
  /** Panel that opens this feature. Omitted for things that live inside the chat itself. */
  modal?: Exclude<ModalId, null>;
  /** Shown when the feature needs something outside the app. */
  requiresKey?: TranslationKey;
}

/**
 * Single source of truth for "what this app gives you", used by the wizard's welcome step and by
 * the help menu. The copy travels as catalog keys, so the list re-renders in the current language.
 * Keep the blurbs short and true: if a panel changes, this list changes with it.
 */
export const FEATURES: FeatureEntry[] = [
  {
    id: "characters",
    nameKey: "onboarding.features.characters.name",
    blurbKey: "onboarding.features.characters.blurb",
    icon: Users,
  },
  {
    id: "presets",
    nameKey: "onboarding.features.presets.name",
    blurbKey: "onboarding.features.presets.blurb",
    icon: SlidersHorizontal,
    modal: "presets",
  },
  {
    id: "personas",
    nameKey: "onboarding.features.personas.name",
    blurbKey: "onboarding.features.personas.blurb",
    icon: UserCircle,
    modal: "personas",
  },
  {
    id: "lorebooks",
    nameKey: "onboarding.features.lorebooks.name",
    blurbKey: "onboarding.features.lorebooks.blurb",
    icon: BookMarked,
    modal: "lorebooks",
  },
  {
    id: "director",
    nameKey: "onboarding.features.director.name",
    blurbKey: "onboarding.features.director.blurb",
    icon: Film,
    modal: "director",
  },
  {
    id: "comfyinject",
    nameKey: "onboarding.features.comfyInject.name",
    blurbKey: "onboarding.features.comfyInject.blurb",
    icon: ImageIcon,
    modal: "comfyinject",
    requiresKey: "onboarding.features.comfyInject.requires",
  },
  {
    id: "recast",
    nameKey: "onboarding.features.recast.name",
    blurbKey: "onboarding.features.recast.blurb",
    icon: Wand2,
    modal: "recast",
  },
  {
    id: "estudio",
    nameKey: "onboarding.features.estudio.name",
    blurbKey: "onboarding.features.estudio.blurb",
    icon: ScrollText,
    modal: "estudio",
  },
  {
    id: "gateton-rp",
    nameKey: "onboarding.features.gatetonRp.name",
    blurbKey: "onboarding.features.gatetonRp.blurb",
    icon: Zap,
    modal: "gateton-roleplay",
  },
  {
    id: "npc",
    nameKey: "onboarding.features.npc.name",
    blurbKey: "onboarding.features.npc.blurb",
    icon: ScanSearch,
    modal: "npc",
  },
  {
    id: "memory",
    nameKey: "onboarding.features.memory.name",
    blurbKey: "onboarding.features.memory.blurb",
    icon: Brain,
  },
  {
    id: "gallery",
    nameKey: "onboarding.features.gallery.name",
    blurbKey: "onboarding.features.gallery.blurb",
    icon: Images,
  },
  {
    id: "usage",
    nameKey: "onboarding.features.usage.name",
    blurbKey: "onboarding.features.usage.blurb",
    icon: Coins,
    modal: "usage",
  },
  {
    id: "import",
    nameKey: "onboarding.features.importSt.name",
    blurbKey: "onboarding.features.importSt.blurb",
    icon: Download,
    modal: "importst",
  },
  {
    id: "themes",
    nameKey: "onboarding.features.themes.name",
    blurbKey: "onboarding.features.themes.blurb",
    icon: Palette,
    modal: "settings",
  },
  {
    id: "guide",
    nameKey: "onboarding.features.guide.name",
    blurbKey: "onboarding.features.guide.blurb",
    icon: Sparkles,
  },
];

/**
 * Where to get an API key, per provider id. Only the providers whose signup page is stable enough
 * to link; anything else falls back to the provider's own site by id lookup miss.
 */
export const PROVIDER_KEY_URLS: Record<string, string> = {
  openrouter: "https://openrouter.ai/keys",
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  google: "https://aistudio.google.com/apikey",
  groq: "https://console.groq.com/keys",
  deepseek: "https://platform.deepseek.com/api_keys",
  xai: "https://console.x.ai/",
  mistral: "https://console.mistral.ai/api-keys",
  together: "https://api.together.ai/settings/api-keys",
  fireworks: "https://fireworks.ai/account/api-keys",
  moonshot: "https://platform.moonshot.ai/console/api-keys",
  zai: "https://z.ai/manage-apikey/apikey-list",
  siliconflow: "https://cloud.siliconflow.cn/account/ak",
  perplexity: "https://www.perplexity.ai/settings/api",
  nanogpt: "https://nano-gpt.com/api",
  chutes: "https://chutes.ai/app/api",
  ai21: "https://studio.ai21.com/account/api-key",
  cohere: "https://dashboard.cohere.com/api-keys",
  "azure-openai": "https://portal.azure.com/",
};
