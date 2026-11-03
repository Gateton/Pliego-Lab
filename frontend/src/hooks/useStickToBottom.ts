import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** How close to the end (px) still counts as "at the bottom". */
const BOTTOM_THRESHOLD = 80;

/**
 * Keeps a scroll container pinned to its end the way a chat should behave:
 * - opening a conversation (a new `resetKey`) lands on the latest message;
 * - while the reader is at the bottom, growing content (a reply streaming in, images loading)
 *   keeps it in view;
 * - as soon as the reader scrolls up to read, nothing moves under them, and `atBottom` turns false
 *   so the caller can offer a "jump to latest" button.
 *
 * Both elements are taken through callback refs because the thread mounts after the chat loads.
 */
export function useStickToBottom(resetKey: string | null) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const stickRef = useRef(true);

  const measure = useCallback(() => {
    if (!container) return;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    const bottom = distance <= BOTTOM_THRESHOLD;
    stickRef.current = bottom;
    setAtBottom(bottom);
  }, [container]);

  const scrollToBottom = useCallback(
    (smooth = false) => {
      if (!container) return;
      stickRef.current = true;
      // "instant" overrides the stylesheet's `scroll-behavior: smooth` for the automatic jumps.
      container.scrollTo({ top: container.scrollHeight, behavior: smooth ? "smooth" : "instant" });
    },
    [container],
  );

  useEffect(() => {
    if (!container) return;
    // A wheel/touch gesture upwards releases the pin immediately, before the scroll event lands —
    // otherwise a reply growing in the same frame would pull the reader straight back down.
    const release = (event: WheelEvent | TouchEvent) => {
      if (event instanceof WheelEvent && event.deltaY >= 0) return;
      stickRef.current = false;
    };
    container.addEventListener("scroll", measure, { passive: true });
    container.addEventListener("wheel", release, { passive: true });
    container.addEventListener("touchmove", release, { passive: true });
    return () => {
      container.removeEventListener("scroll", measure);
      container.removeEventListener("wheel", release);
      container.removeEventListener("touchmove", release);
    };
  }, [container, measure]);

  useEffect(() => {
    if (!container || !content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (stickRef.current) container.scrollTo({ top: container.scrollHeight, behavior: "instant" });
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [container, content]);

  // Opening a chat (or the thread mounting for the first time) lands on the latest message.
  useLayoutEffect(() => {
    if (!container) return;
    scrollToBottom(false);
    measure();
  }, [container, resetKey, scrollToBottom, measure]);

  return { containerRef: setContainer, contentRef: setContent, atBottom, scrollToBottom };
}
