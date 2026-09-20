/**
 * Usage and cost dashboard.
 *
 * Same keys as the Spanish catalog, different values. "Memory", "Writing Style" and "OpenRouter"
 * are product names and stay as they are.
 */
export const usage = {
  description:
    "Tokens and cost per chat and per pipeline stage. Only available with OpenRouter as the active provider: it uses the real cost the provider reports, and estimates it from published pricing when none comes back — never an invented number.",
  /** Pipeline stages an event can belong to. */
  stage: {
    main: "Main chat",
    memory: "Memory",
    memoryPlus: "Memory Plus",
    characterGen: "Character generation",
  },
  stats: {
    inputTokens: "Input tokens",
    outputTokens: "Output tokens",
    totalCost: "Estimated total cost",
    chatsWithUsage: "Chats with recorded usage",
  },
  unknownPricing: "Some events have no known price (model not listed on OpenRouter right now) — they are not included in the $ shown.",
  byChat: {
    title: "By chat",
    sortedByCost: "sorted by cost",
    empty: "No usage recorded in any chat yet. It shows up automatically as you chat.",
    messages: "messages",
    idleCount: "chats with no recorded usage",
    idleCount_one: "chat with no recorded usage",
    idleCount_other: "chats with no recorded usage",
  },
  table: {
    stage: "Stage",
    model: "Model",
    input: "Input",
    output: "Output",
    cost: "Cost",
    total: "Total",
  },
  unit: {
    tokens: "tokens",
  },
  global: {
    title: "Global (no chat attached)",
    hint: "Character generation, Writing Style, and other calls that don't belong to a specific chat.",
  },
};
