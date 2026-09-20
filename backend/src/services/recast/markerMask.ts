import { MARKER_REGEX_GLOBAL } from "../comfyInject/markerParser.js";

const PLACEHOLDER_REGEX = /⟦IMG:(\d+)⟧/g;

/**
 * Replaces every `[[IMG: ...]]` marker with a stable placeholder that doesn't resemble
 * natural prose, so a prose-editing pass is far less likely to "correct" it away — a
 * mechanical guarantee instead of relying purely on the pass's prompt instructions.
 */
export function maskMarkers(text: string): { masked: string; unmask: (text: string) => string } {
  const markers: string[] = [];
  const masked = text.replace(new RegExp(MARKER_REGEX_GLOBAL), (match) => {
    const index = markers.length;
    markers.push(match);
    return `⟦IMG:${index}⟧`;
  });

  function unmask(input: string): string {
    return input.replace(PLACEHOLDER_REGEX, (match, indexStr) => {
      const index = Number(indexStr);
      return markers[index] ?? match;
    });
  }

  return { masked, unmask };
}
