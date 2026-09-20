/**
 * Image Director: visual state and history.
 *
 * Same keys as the Spanish catalog, different values. The placeholders hold image tags, so they
 * stay in the tag vocabulary instead of being translated.
 */
export const director = {
  /** Per-chat visual ledger: current outfit, state tags and history. */
  visualState: {
    check: "Check state (last message)",
    checking: "Checking…",
    checkHint: "Audits/corrects the ledger against the last message, without generating or touching any image.",
    empty: {
      title: "No visual state recorded in this chat yet.",
      hint: 'Appears automatically when the Director detects an outfit/state change, with "Persistent visual state" enabled in its settings.',
    },
    delete: "Delete record",
    outfit: "Current outfit",
    outfitPlaceholder: "white silk dress, black leather boots…",
    state: "State (comma separated)",
    statePlaceholder: "wet, torn dress, bruised…",
    updatedAt: "Last updated: {date}",
    history: "History ({count})",
  },
};
