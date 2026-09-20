// Ported (logic, not code) from Roleplay Suite's features/memory/keywords.js — mirrors
// backend/src/services/roleplay/keywords.ts so NPC Bank's relevance scoring can run purely in
// the frontend (no network), same as Writing Style/Engine/Global Toggles/Add-ons/Blocks.
const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "your", "with", "that", "this",
  "have", "has", "had", "was", "were", "will", "would", "could", "should", "can",
  "just", "like", "into", "onto", "then", "than", "them", "they", "she", "his",
  "her", "him", "its", "our", "who", "what", "when", "where", "why", "how", "all",
  "any", "some", "there", "here", "from", "about", "over", "under", "again", "more",
  "most", "very", "much", "still", "even", "also", "did", "does", "doing", "been",
  "being", "which", "while", "because", "before", "after", "each", "such", "own",
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "que", "y",
  "en", "con", "por", "para", "su", "sus", "se", "lo", "le", "les", "es", "son",
  "era", "eran", "fue", "fueron", "esta", "estas", "este", "estos", "eso", "esa",
  "esas", "esos", "pero", "como", "cuando", "donde", "porque", "muy", "mas", "más",
  "todo", "toda", "todos", "todas", "ya", "sin", "sobre", "entre", "hasta", "desde",
  "también", "tambien", "sí", "si", "no", "al", "yo", "tu", "tú", "mi", "nos",
]);

export function extractKeywords(text: string): string[] {
  if (!text || typeof text !== "string") return [];

  const words: string[] = [];
  try {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
    for (const segment of segmenter.segment(text.toLowerCase())) {
      if (!segment.isWordLike) continue;
      const word = segment.segment.trim();
      if (word.length < 3 || STOPWORDS.has(word)) continue;
      words.push(word);
    }
  } catch {
    const matches = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    for (const word of matches) {
      if (word.length < 3 || STOPWORDS.has(word)) continue;
      words.push(word);
    }
  }

  return [...new Set(words)];
}
