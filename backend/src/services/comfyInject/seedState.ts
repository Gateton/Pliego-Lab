// Port of comfyinject3.0/src/state.js — seed resolution for RANDOM/LOCK/explicit tokens.
import type { Chat } from "../../types.js";

function generateRandomSeed(): number {
  return Math.floor(Math.random() * 9007199254740991);
}

/**
 * Scans assistant messages before `beforeMessageId`, looking only at each message's
 * *active* swipe (never a discarded swipe branch), for the most recent successfully
 * generated image's seed.
 */
function getLastSavedSeed(chat: Chat, beforeMessageId: string | undefined): number | null {
  const index = beforeMessageId ? chat.messages.findIndex((m) => m.id === beforeMessageId) : chat.messages.length;
  const scanFrom = index === -1 ? chat.messages.length : index;

  for (let i = scanFrom - 1; i >= 0; i--) {
    const message = chat.messages[i];
    if (message.role !== "assistant" || !message.images) continue;

    const prefix = `${message.activeSwipeIndex}:`;
    const seeds = Object.entries(message.images)
      .filter(([key, result]) => key.startsWith(prefix) && result.status === "ok")
      .map(([, result]) => (result as { seed: number }).seed);

    if (seeds.length > 0) return seeds[seeds.length - 1];
  }

  return null;
}

/** Resolves a seed token ("RANDOM" | "LOCK" | digits) into a concrete integer. */
export function resolveSeed(seedToken: string, chat: Chat, beforeMessageId: string | undefined): number {
  if (seedToken === "RANDOM") return generateRandomSeed();

  if (seedToken === "LOCK") {
    const saved = getLastSavedSeed(chat, beforeMessageId);
    return saved !== null ? saved : generateRandomSeed();
  }

  const parsed = parseInt(seedToken, 10);
  return Number.isFinite(parsed) ? parsed : generateRandomSeed();
}
