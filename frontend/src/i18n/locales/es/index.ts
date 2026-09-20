/**
 * Spanish is the source of truth for the key shape. Every other catalog is typed against this one,
 * so a missing or misspelled key fails the build instead of silently falling back at runtime.
 *
 * Keys and structure are English and camelCase; only the values are Spanish. Namespaces are
 * separate modules so that two people can translate two areas of the app without touching the same
 * file. Import them with the explicit `.ts` extension: the i18n check script runs under Node's
 * native type stripping, which resolves extensions the way Node does.
 */
import { common } from "./common.ts";
import { settings } from "./settings.ts";
import { chrome } from "./chrome.ts";
import { chat } from "./chat.ts";
import { characters } from "./characters.ts";
import { personas } from "./personas.ts";
import { presets } from "./presets.ts";
import { lorebooks } from "./lorebooks.ts";
import { memory } from "./memory.ts";
import { roleplay } from "./roleplay.ts";
import { estudio } from "./estudio.ts";
import { director } from "./director.ts";
import { npc } from "./npc.ts";
import { usage } from "./usage.ts";
import { onboarding } from "./onboarding.ts";

export const es = { common, settings, chrome, chat, characters, personas, presets, lorebooks, memory, roleplay, estudio, director, npc, usage, onboarding };
