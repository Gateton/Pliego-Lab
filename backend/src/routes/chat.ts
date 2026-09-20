import { Router } from "express";
import {
  streamChat,
  completeChat,
  ProviderRequestError,
  type ChatMessage,
  type SamplingParams,
} from "../services/llm.js";
import { recordUsage } from "../services/usageStore.js";

export const chatRouter = Router();

chatRouter.post("/stream", async (req, res) => {
  const { messages, model, sampling, streaming, chatId } = req.body as {
    messages?: ChatMessage[];
    model?: string;
    sampling?: SamplingParams;
    streaming?: boolean;
    chatId?: string;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages must be a non-empty array" });
    return;
  }

  const abortController = new AbortController();
  // `req` emits "close" as soon as the request body is fully read, not when the
  // client disconnects — use `res` and guard against the normal end-of-response case.
  res.on("close", () => {
    if (!res.writableEnded) abortController.abort();
  });

  let startedStreaming = false;

  try {
    if (streaming === false) {
      // The frontend's parser only understands this SSE envelope, so even with real
      // streaming off we still deliver the (complete) reply as a single "token" event
      // over the same channel — no separate response shape to maintain.
      const { content, reasoning, usage, provider, model: usedModel } = await completeChat(
        { messages, model, sampling },
        abortController.signal,
      );
      await recordUsage({ chatId: chatId ?? null, stage: "main", provider, model: usedModel, ...usage, timestamp: Date.now() });
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      if (reasoning) res.write(`data: ${JSON.stringify({ type: "reasoning", content: reasoning })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "token", content })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
      return;
    }

    const generator = streamChat({ messages, model, sampling }, abortController.signal);

    while (true) {
      const { value, done } = await generator.next();
      if (done) {
        if (value) {
          await recordUsage({
            chatId: chatId ?? null,
            stage: "main",
            provider: value.provider,
            model: value.model,
            ...value.usage,
            timestamp: Date.now(),
          });
        }
        break;
      }
      const delta = value;
      if (!startedStreaming) {
        startedStreaming = true;
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
      }
      if (delta.type === "reasoning") {
        res.write(`data: ${JSON.stringify({ type: "reasoning", content: delta.text })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ type: "token", content: delta.text })}\n\n`);
      }
    }

    if (!startedStreaming) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
    }
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (error) {
    if (abortController.signal.aborted) {
      // Client disconnected; nothing to send back.
      return;
    }

    if (!startedStreaming) {
      const status = error instanceof ProviderRequestError ? error.status : 500;
      res.status(status).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return;
    }

    res.write(
      `data: ${JSON.stringify({
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      })}\n\n`,
    );
    res.end();
  }
});
