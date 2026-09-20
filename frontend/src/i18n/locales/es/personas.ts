/**
 * Personas: the user's own identities.
 *
 * Keys are English and camelCase; only the values are translated. Add keys here and to the English
 * file in the same commit: the guard fails on a catalog that is out of sync.
 *
 * Shared wording (the persona name label, `Quitar`, `Generando…`) lives in `characters.card` and
 * `characters.action`, next to the character screens that use it too.
 */
export const personas = {
  title: "Personas",
  description: "Quién sos vos en la historia. Podés tener varias y elegir cuál usar al crear cada chat.",
  empty: "Todavía no creaste ninguna persona.",
  create: "Nueva persona",
  /** Row buttons of the persona list. The short `title` tooltips come from `characters.action`. */
  actions: {
    edit: "Editar persona",
    delete: "Borrar persona",
  },
  form: {
    avatarAlt: "Avatar",
    changeAvatar: "Cambiar avatar",
    generateAvatar: "Generar avatar",
    /** Tooltip shown while the persona still has no image tags. */
    generateAvatarBlocked: "Necesitás tags de imagen primero",
    generateAvatarTitle: "Generar avatar con IA a partir de los tags de imagen",
    descriptionLabel: "Descripción / boceto",
    descriptionHint: "Escribí lo que sepas — hasta suelto, sin estructurar. 'Se llama Thomas, alto y fuerte, rubio, 1.70, no le gusta el brócoli...'. Se le pasa al modelo como {{user}}, y es la fuente para 'Generar con IA'.",
    lorebookLabel: "Lorebook personal",
    lorebookHint: "Sus entradas acompañan a esta persona en cualquier chat donde la uses.",
    lorebookNone: "Ninguno",
    generateDossier: "Generar ficha con IA",
    generateNote: "Completa los campos de abajo a partir de la descripción — a diferencia de los NPCs de una historia, acá SÍ es válido que la IA invente/extrapole razonablemente lo que el boceto no cubre.",
  },
  error: {
    dossier: "Error al generar la ficha",
    avatar: "Error al generar el avatar",
  },
};
