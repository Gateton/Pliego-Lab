// Chat title generation — a tiny, best-effort utility call with its own short timeout. Uses the
// active provider's model; on OpenRouter it keeps the original "try several free models" chain so
// titling never costs anything, and on other providers it falls back to the active model.
import { completeChat } from "./llm.js";
import { getActiveProvider, getActiveProviderId } from "./providers/resolve.js";

// Curated list of always-free OpenRouter chat models, tried in order for the tiny "generate a
// chat title" task. Free models are rate-limited and can randomly 404/429, so we chain through
// several before giving up — the caller falls back to the first-few-words default on null.
const FREE_TITLE_MODELS = [
  "nvidia/nemotron-3.5-lightning:free",
  "google/gemma-4-26b-a4b-it:free",
  "minimax/minimax-m3:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
];

const TITLE_TIMEOUT_MS = 15_000;

function cleanTitle(raw: string): string | null {
  const title = raw
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/[.!?]+$/, "")
    .trim();
  return title && title.length <= 80 ? title : null;
}

/** Generates a short chat title from the first user message. Returns null when every attempt fails. */
export async function generateChatTitle(characterName: string, text: string, model?: string): Promise<string | null> {
  const systemPrompt =
    "You generate short, descriptive titles for roleplay chat conversations. Return ONLY the title (3 to 6 words), written in the same language as the conversation, no quotes, no trailing punctuation, no explanation.";
  const userPrompt = `Character: ${characterName || "Unknown"}\n\nFirst message:\n${text}\n\nTitle:`;
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];

  const providerId = await getActiveProviderId();
  const { connection } = await getActiveProvider();
  const candidates: (string | undefined)[] = [];
  if (model?.trim()) candidates.push(model.trim());
  if (providerId === "openrouter") candidates.push(...FREE_TITLE_MODELS);
  if (connection.defaultModel) candidates.push(connection.defaultModel);

  for (const candidate of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TITLE_TIMEOUT_MS);
    try {
      const { content } = await completeChat(
        { messages, model: candidate, sampling: { temperature: 0.7, max_tokens: 24 } },
        controller.signal,
      );
      const title = cleanTitle(content);
      if (title) return title;
    } catch {
      // Rate-limited / not found / timed out — try the next candidate.
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
