// Trivial regex mirror of the backend's markerParser.ts — only used here to split text
// for rendering. The actual token classification logic lives exclusively in the backend.
export const MARKER_SOURCE = /\[\[IMG:\s*(.+?)\s*\]\]/s;

export function hasImageMarker(text: string): boolean {
  return MARKER_SOURCE.test(text);
}

export type TextSegment = { type: "text"; content: string } | { type: "marker"; index: number; raw: string };

export function splitTextWithMarkers(text: string): TextSegment[] {
  const regex = new RegExp(MARKER_SOURCE, "gs");
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let markerIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: "marker", index: markerIndex, raw: match[0] });
    markerIndex++;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  return segments;
}
