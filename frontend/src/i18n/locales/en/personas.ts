/**
 * Personas: the user's own identities.
 *
 * Keys are English and camelCase; only the values are translated. Add keys here and to the English
 * file in the same commit: the guard fails on a catalog that is out of sync.
 *
 * Shared wording (the persona name label, `Remove`, `Generating…`) lives in `characters.card` and
 * `characters.action`, next to the character screens that use it too.
 */
export const personas = {
  title: "Personas",
  description: "Who you are in the story. You can keep several and pick which one to use when you create a chat.",
  empty: "You have not created a persona yet.",
  create: "New persona",
  /** Row buttons of the persona list. The short `title` tooltips come from `characters.action`. */
  actions: {
    edit: "Edit persona",
    delete: "Delete persona",
  },
  form: {
    avatarAlt: "Avatar",
    changeAvatar: "Change avatar",
    generateAvatar: "Generate avatar",
    /** Tooltip shown while the persona still has no image tags. */
    generateAvatarBlocked: "You need image tags first",
    generateAvatarTitle: "Generate an avatar with AI from the image tags",
    descriptionLabel: "Description / sketch",
    descriptionHint: "Write down whatever you know — even loose and unstructured. 'His name is Thomas, tall and strong, blond, 1.70 m, he does not like broccoli...'. It is passed to the model as {{user}}, and it is the source for 'Generate with AI'.",
    lorebookLabel: "Personal lorebook",
    lorebookHint: "Its entries travel with this persona into every chat where you use it.",
    lorebookNone: "None",
    generateDossier: "Generate card with AI",
    generateNote: "Fills in the fields below from the description — unlike the NPCs of a story, here it IS fine for the AI to reasonably invent or extrapolate what the sketch does not cover.",
  },
  error: {
    dossier: "Could not generate the card",
    avatar: "Could not generate the avatar",
  },
};
