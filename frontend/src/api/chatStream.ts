import { t } from "../i18n";
import { responseError } from "./requestError";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface SamplingParams {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  repetition_penalty?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  max_tokens?: number;
  min_p?: number;
  seed?: number;
  n?: number;
  transforms?: string[];
  reasoning?: { effort?: "auto" | "low" | "medium" | "high"; exclude?: boolean; enabled?: boolean };
  verbosity?: "auto" | "low" | "medium" | "high";
}

interface StreamChatHandlers {
  onToken: (content: string) => void;
  onReasoning?: (content: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

export async function streamChat(
  messages: ChatMessage[],
  sampling: SamplingParams | undefined,
  { onToken, onReasoning, onDone, onError }: StreamChatHandlers,
  model?: string,
  streaming = true,
  signal?: AbortSignal,
  chatId?: string,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, sampling, model, streaming, chatId }),
      signal,
    });
  } catch (err) {
    // An abort here means the user hit Stop before the response even started — that's a
    // clean, intentional stop, not a failure to surface as an error.
    if (err instanceof DOMException && err.name === "AbortError") onDone();
    else onError(t("chat.errors.backendUnreachable"));
    return;
  }

  if (!response.ok || !response.body) {
    onError((await responseError(response)).message);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;

        const data = trimmed.slice("data:".length).trim();
        try {
          const event = JSON.parse(data);
          if (event.type === "token") onToken(event.content);
          else if (event.type === "reasoning") onReasoning?.(event.content);
          else if (event.type === "done") onDone();
          else if (event.type === "error") onError(event.message);
        } catch {
          // Ignore malformed/partial SSE lines.
        }
      }
    }
  } catch (err) {
    // Stopped mid-stream (user hit Stop, which aborts the fetch and rejects the pending read)
    // — whatever text already arrived stays on the message, same as a normal completion.
    if (err instanceof DOMException && err.name === "AbortError") onDone();
    else throw err;
  }
}
