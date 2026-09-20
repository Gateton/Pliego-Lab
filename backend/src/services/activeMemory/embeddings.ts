import { getActiveProvider, requireUsableConnection } from "../providers/resolve.js";

/**
 * Optional semantic layer for Memoria Viva.
 *
 * The whole memory engine is designed to work with zero infrastructure: entity matches, causal
 * links and recency are enough to keep a long chat coherent, and they stay debuggable. Embeddings
 * are therefore strictly additive — when no provider offers them, or the user keeps the feature
 * off, every caller falls back to the lexical score instead of failing.
 */

export interface EmbeddingsResult {
  vectors: number[][];
  model: string;
}

/** Cosine similarity in [-1, 1]; returns 0 for mismatched or degenerate vectors. */
export function cosineSimilarity(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === "number" && Number.isFinite(entry));
}

/**
 * Calls the active provider's OpenAI-compatible `/embeddings` endpoint. Providers that do not expose
 * one throw, and the caller is expected to treat that as "semantic retrieval unavailable".
 */
export async function embedTexts(texts: string[], options: { model?: string; signal?: AbortSignal } = {}): Promise<EmbeddingsResult> {
  if (texts.length === 0) return { vectors: [], model: options.model ?? "" };
  const { connection } = await getActiveProvider();
  requireUsableConnection(connection);

  const model = options.model?.trim() || connection.defaultModel;
  const response = await fetch(`${connection.baseUrl.replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(connection.apiKey ? { Authorization: `Bearer ${connection.apiKey}` } : {}),
    },
    body: JSON.stringify({ model, input: texts }),
    signal: options.signal ?? new AbortController().signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Embeddings request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }

  const payload = (await response.json()) as { data?: Array<{ embedding?: unknown; index?: number }> };
  const entries = Array.isArray(payload.data) ? payload.data : [];
  if (entries.length !== texts.length) {
    throw new Error(`Embeddings response returned ${entries.length} vector(s) for ${texts.length} input(s)`);
  }
  const ordered = [...entries].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
  const vectors = ordered.map((entry) => entry.embedding);
  if (!vectors.every(isNumberArray)) throw new Error("Embeddings response contained a malformed vector");
  return { vectors, model };
}
