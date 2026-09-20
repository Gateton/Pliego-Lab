/**
 * English catalog. `satisfies typeof es` is what makes the translation complete: a key that exists
 * in Spanish and not here is a compile error, and so is a key invented here that Spanish does not
 * have. Do not replace it with a type annotation, which would silently allow both.
 */
import type { es } from "../es/index.ts";
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

export const en = { common, settings, chrome, chat, characters, personas, presets, lorebooks, memory, roleplay, estudio, director, npc, usage, onboarding } satisfies typeof es;
