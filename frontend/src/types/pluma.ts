// Pluma ("Pluma Style") — writing-format rules with examples. The user tells the model how to
// write the roleplay: narration, dialogue, sounds, prohibitions. Every rule stays short so it
// does not inflate the context.

import type { TranslationKey } from "../i18n";

export interface PlumaRule {
  id: string;
  enabled: boolean;
  title: string;
  instruction: string;
  example: string;
}

export interface PlumaSettings {
  enabled: boolean;
  rules: PlumaRule[];
}

/**
 * A ready-made rule the picker offers. The texts are catalog keys, not literals: PlumaModule
 * resolves them when the user picks the template, so the rule that gets inserted reads in the
 * language the interface is in at that moment.
 *
 * `nameKey` is interface copy and is translated. `instructionKey` / `exampleKey` are prompt content
 * (they travel to the model inside the macro), so both catalogs carry the same wording for them.
 */
export interface PlumaTemplate {
  id: string;
  enabled: boolean;
  nameKey: TranslationKey;
  instructionKey: TranslationKey;
  /** Absent when the template ships without an example. */
  exampleKey?: TranslationKey;
}

export const PLUMA_TEMPLATES: PlumaTemplate[] = [
  {
    id: "narracion",
    enabled: true,
    nameKey: "roleplay.pluma.template.narration.name",
    instructionKey: "roleplay.pluma.template.narration.instruction",
    exampleKey: "roleplay.pluma.template.narration.example",
  },
  {
    id: "dialogo",
    enabled: true,
    nameKey: "roleplay.pluma.template.dialogue.name",
    instructionKey: "roleplay.pluma.template.dialogue.instruction",
    exampleKey: "roleplay.pluma.template.dialogue.example",
  },
  {
    id: "sonidos",
    enabled: true,
    nameKey: "roleplay.pluma.template.sounds.name",
    instructionKey: "roleplay.pluma.template.sounds.instruction",
    exampleKey: "roleplay.pluma.template.sounds.example",
  },
  {
    id: "prohibido-raya",
    enabled: true,
    nameKey: "roleplay.pluma.template.noDashes.name",
    instructionKey: "roleplay.pluma.template.noDashes.instruction",
  },
];

/** Prompt content for built-in templates is intentionally English in every interface locale. */
export const PLUMA_ENGLISH_TEXT: Record<string, { title: string; instruction: string; example: string }> = {
  narracion: {
    title: "Narration",
    instruction: "All narration, actions, and descriptions ALWAYS go between *asterisks*, never as plain text and never with dashes.",
    example: "*Lara tells the duke to shut up*",
  },
  dialogo: {
    title: "Dialogue",
    instruction: "Dialogue is preceded by the character's name and wrapped in <font color=\"#HEX\">, with one fixed color per character.",
    example: 'Duke: <font color="#c0392b">"Shut up!"</font>',
  },
  sonidos: {
    title: "Sounds",
    instruction: "Sounds and onomatopoeia go inside <font color> within the narration.",
    example: '*Just then there was a* <font color="#HEX">TOK</font> *and everyone panicked*',
  },
  "prohibido-raya": {
    title: "Forbidden",
    instruction: "NEVER use em dashes (—) or bare quotes for narration or dialogue.",
    example: "",
  },
};
