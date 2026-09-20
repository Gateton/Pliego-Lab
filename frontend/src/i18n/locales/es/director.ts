/**
 * Image Director: visual state and history.
 *
 * Keys are English and camelCase; only the values are translated. Add keys here and to the English
 * file in the same commit: the guard fails on a catalog that is out of sync.
 */
export const director = {
  /** Per-chat visual ledger: current outfit, state tags and history. */
  visualState: {
    check: "Revisar estado (último mensaje)",
    checking: "Revisando…",
    checkHint: "Audita/corrige el ledger contra el último mensaje, sin generar ni tocar imágenes.",
    empty: {
      title: "Todavía no hay estado visual registrado en este chat.",
      hint: 'Aparece automáticamente cuando el Director detecta un cambio de ropa/estado, con "Estado visual persistente" activado en su configuración.',
    },
    delete: "Borrar registro",
    outfit: "Outfit actual",
    outfitPlaceholder: "white silk dress, black leather boots…",
    state: "Estado (separado por coma)",
    statePlaceholder: "wet, torn dress, bruised…",
    updatedAt: "Última actualización: {date}",
    history: "Historial ({count})",
  },
};
