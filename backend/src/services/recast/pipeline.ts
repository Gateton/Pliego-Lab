import { streamChat, type ChatMessage as ORMessage, type GenerationMeta, type NormalizedUsage, type ProviderId } from "../llm.js";
import { maskMarkers } from "./markerMask.js";

export interface RecastPassUsage {
  provider: ProviderId;
  model: string;
  usage: NormalizedUsage;
}

export interface RecastPassRequest {
  passId: string;
  model?: string;
  systemPrompt: string;
  userPrefix: string;
  sceneContextMessages?: { role: "user" | "assistant"; content: string }[];
}

function buildMessages(pass: RecastPassRequest, currentText: string): ORMessage[] {
  const userContent = [pass.userPrefix, `<text_to_transform>\n${currentText}\n</text_to_transform>`]
    .filter((s) => s.trim() !== "")
    .join("\n\n");

  const messages: ORMessage[] = [{ role: "system", content: pass.systemPrompt }];
  if (pass.sceneContextMessages?.length) messages.push(...pass.sceneContextMessages);
  messages.push({ role: "user", content: userContent });
  return messages;
}

async function runOnePass(
  pass: RecastPassRequest,
  currentText: string,
): Promise<{ text: string; usage?: RecastPassUsage }> {
  try {
    const messages = buildMessages(pass, currentText);
    const controller = new AbortController();
    let result = "";
    const generator = streamChat({ messages, model: pass.model }, controller.signal);
    let meta: GenerationMeta | undefined;
    while (true) {
      const { value, done } = await generator.next();
      if (done) {
        meta = value;
        break;
      }
      if (value.type === "content") result += value.text;
    }
    const trimmed = result.trim();
    const passUsage = meta ? { provider: meta.provider, model: meta.model, usage: meta.usage } : undefined;
    // A pass that returns nothing is treated as a no-op — never lose the prior text.
    return { text: trimmed ? trimmed : currentText, usage: passUsage };
  } catch {
    return { text: currentText };
  }
}

/**
 * Runs every pass sequentially over `text`, masking `[[IMG:...]]` markers once before the
 * first pass and unmasking once after the last — passes never see or can corrupt the real
 * marker text. Never throws: an individual pass failure just leaves the text unchanged.
 * Returns the final text plus a snapshot of the (unmasked) text after every step, so the
 * frontend can render a per-pass diff (original → pass 1 → pass 2 → … → final).
 */
export async function runRecastPipeline(
  text: string,
  passes: RecastPassRequest[],
): Promise<{ text: string; snapshots: string[]; usages: RecastPassUsage[] }> {
  const { masked, unmask } = maskMarkers(text);
  let currentText = masked;
  const snapshots: string[] = [unmask(masked)];
  const usages: RecastPassUsage[] = [];

  for (const pass of passes) {
    const result = await runOnePass(pass, currentText);
    currentText = result.text;
    if (result.usage) usages.push(result.usage);
    snapshots.push(unmask(currentText));
  }

  return { text: unmask(currentText), snapshots, usages };
}
