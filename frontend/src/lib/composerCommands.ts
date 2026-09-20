/**
 * Every slash command the composer knows how to autocomplete. Extend this list — the suggestion
 * mechanics in Composer don't need to change for a new command. It lives here (instead of inside
 * the composer) so the help menu can list the same commands without duplicating the copy.
 *
 * `command` is the literal token the user types, so it is never translated; the argument hint and
 * the description are copy, so this list stores their catalog keys and each screen resolves them
 * with `t(...)` while rendering.
 */
import type { TranslationKey } from "../i18n";

export interface SlashCommand {
  command: string;
  /** Argument hint shown while completing the command. */
  argsKey: TranslationKey;
  descriptionKey: TranslationKey;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { command: "/img", argsKey: "chat.commands.img.args", descriptionKey: "chat.commands.img.description" },
];
