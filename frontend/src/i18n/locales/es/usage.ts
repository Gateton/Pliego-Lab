/**
 * Usage and cost dashboard.
 *
 * Keys are English and camelCase; only the values are translated. Add keys here and to the English
 * file in the same commit: the guard fails on a catalog that is out of sync.
 *
 * Stage labels that are the name of a module (Image Director, Recast, NPC Tracker) use the key the
 * shell already has for that name instead of being defined twice.
 */
export const usage = {
  description:
    "Tokens y costo por chat y por etapa del pipeline. Disponible solo con OpenRouter como proveedor activo: se usa el costo real que reporta el proveedor, y se estima con su pricing publicado cuando no viene — nunca un número inventado.",
  /** Pipeline stages an event can belong to. */
  stage: {
    main: "Chat principal",
    memory: "Memory",
    memoryPlus: "Memory Plus",
    characterGen: "Generación de personaje",
  },
  stats: {
    inputTokens: "Tokens de entrada",
    outputTokens: "Tokens de salida",
    totalCost: "Costo estimado total",
    chatsWithUsage: "Chats con uso registrado",
  },
  unknownPricing: "Algunos eventos no tienen precio conocido (modelo no listado en OpenRouter ahora) — no se incluyen en el $ mostrado.",
  byChat: {
    title: "Por chat",
    sortedByCost: "ordenado por costo",
    empty: "Todavía no se registró uso en ningún chat. Aparece automáticamente a medida que chateás.",
    messages: "mensajes",
    idleCount: "chats sin uso registrado",
    idleCount_one: "chat sin uso registrado",
    idleCount_other: "chats sin uso registrado",
  },
  table: {
    stage: "Etapa",
    model: "Modelo",
    input: "Entrada",
    output: "Salida",
    cost: "Costo",
    total: "Total",
  },
  unit: {
    tokens: "tokens",
  },
  global: {
    title: "Global (sin chat asociado)",
    hint: "Generación de personaje, Writing Style, y otras llamadas que no pertenecen a un chat puntual.",
  },
};
