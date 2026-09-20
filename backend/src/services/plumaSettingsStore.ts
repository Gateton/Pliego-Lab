import type { PlumaSettings } from "../types.js";
import { createJsonObjectStore } from "./jsonObjectStore.js";

const DEFAULT_SETTINGS: PlumaSettings = {
  enabled: true,
  rules: [
    {
      id: "narracion",
      enabled: true,
      title: "Narration",
      instruction: "All narration, actions, and descriptions ALWAYS go between *asterisks*, never as plain text and never with dashes.",
      example: "*Lara tells the duke to shut up*",
    },
    {
      id: "dialogo",
      enabled: true,
      title: "Dialogue",
      instruction: "Dialogue is preceded by the character's name and wrapped in <font color=\"#HEX\">, with one fixed color per character.",
      example: "Duke: <font color=\"#c0392b\">\"Shut up!\"</font>",
    },
    {
      id: "sonidos",
      enabled: true,
      title: "Sounds",
      instruction: "Sounds and onomatopoeia go inside <font color> within the narration.",
      example: "*Just then there was a* <font color=\"#HEX\">TOK</font> *and everyone panicked*",
    },
    {
      id: "prohibido-raya",
      enabled: false,
      title: "Forbidden",
      instruction: "NEVER use em dashes (—) or bare quotes for narration or dialogue.",
      example: "",
    },
    {
      id: "pensamientos",
      enabled: false,
      title: "Thoughts",
      instruction: "Internal thoughts go in *italic asterisks*, without quotation marks.",
      example: "*I cannot believe they said that.*",
    },
    {
      id: "ooc",
      enabled: false,
      title: "OOC",
      instruction: "Out-of-character comments go in parentheses, prefixed with OOC.",
      example: "(OOC: Is this canon or are we making it up?)",
    },
    {
      id: "longitud",
      enabled: false,
      title: "Paragraphs",
      instruction: "Use paragraphs of 3 to 5 lines. NO walls of text; separate the ideas.",
      example: "",
    },
    {
      id: "silencios",
      enabled: false,
      title: "Pauses",
      instruction: "Use … for pauses and hesitations, not to cut dialogue in half.",
      example: "*She opened her mouth… then closed it.*",
    },
    {
      id: "transicion",
      enabled: false,
      title: "Transition",
      instruction: "Mark a scene change or time jump with a separate line containing ***.",
      example: "***\n*Three days later…*",
    },
  ],
};

const store = createJsonObjectStore<PlumaSettings>("plumaSettings.json", DEFAULT_SETTINGS);

export const getPlumaSettings = store.get;
export const updatePlumaSettings = store.update;
