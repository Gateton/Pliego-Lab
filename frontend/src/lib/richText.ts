import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({
  breaks: true, // a single newline becomes <br> — matches how RP prose is actually written
  gfm: true,
});

/**
 * Renders the model's markdown (bold/italics/etc.) and any raw HTML it writes (e.g. a
 * <font color="..."> for per-character dialogue tinting, <details> for a collapsible aside)
 * into sanitized HTML, safe to render via dangerouslySetInnerHTML.
 *
 * <img> is deliberately forbidden even though DOMPurify allows it by default: a markdown
 * image pointing at an arbitrary external URL would make the browser eagerly fetch it — a
 * cheap way for a jailbroken model or a hostile character card to leak the reader's IP to a
 * third party. We already have our own controlled image pipeline ([[IMG:...]] + ComfyInject);
 * untrusted external images from chat text aren't needed here.
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Wraps a literal "@Name" mention of a known NPC in a clickable span before markdown parsing —
 * raw HTML passes through marked untouched, same as <font>/<details> already do. */
function wrapNpcMentions(text: string, npcNames: string[]): string {
  let result = text;
  for (const name of npcNames) {
    if (!name.trim()) continue;
    const re = new RegExp(`@${escapeRegExp(name)}\\b`, "gi");
    result = result.replace(re, (match) => `<span class="npc-mention" data-npc-name="${name}">${match}</span>`);
  }
  return result;
}

export function renderRichText(text: string, npcNames: string[] = []): string {
  const source = npcNames.length > 0 ? wrapNpcMentions(text, npcNames) : text;
  const html = marked.parse(source, { async: false }) as string;
  return DOMPurify.sanitize(html, { FORBID_TAGS: ["img"] });
}
