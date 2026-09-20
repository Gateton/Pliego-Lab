import { useCallback, useState } from "react";

type Updater = number | ((prev: number) => number);

/** Number state persisted to localStorage (panel widths), with functional-updater support. */
export function usePersistedNumber(key: string, initial: number): [number, (updater: Updater) => void] {
  const [value, setValue] = useState<number>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      const n = raw === null ? initial : Number(raw);
      return Number.isFinite(n) ? n : initial;
    } catch {
      return initial;
    }
  });

  const set = useCallback(
    (updater: Updater) => {
      setValue((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        try {
          window.localStorage.setItem(key, String(next));
        } catch {
          // ignore storage errors
        }
        return next;
      });
    },
    [key],
  );

  return [value, set];
}
