/**
 * Approximate token counting by character count (~4 chars/token, the standard rule of thumb).
 * OpenRouter routes to dozens of providers with different real tokenizers, so an exact count
 * isn't feasible without a heavyweight per-model dependency — this is a deliberate estimate,
 * good enough to budget context and to show a rough size badge in the UI.
 */
const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Drops the oldest entries from `items` (via `textOf`) until the total estimated token count
 * fits within `budgetTokens`. Always keeps at least the most recent entry, even if it alone
 * exceeds the budget — never truncates a single message's own content.
 */
export function trimToTokenBudget<T>(items: T[], textOf: (item: T) => string, budgetTokens: number): T[] {
  if (items.length === 0) return items;
  let total = items.reduce((sum, item) => sum + estimateTokens(textOf(item)), 0);
  let start = 0;
  while (start < items.length - 1 && total > budgetTokens) {
    total -= estimateTokens(textOf(items[start]));
    start++;
  }
  return items.slice(start);
}
