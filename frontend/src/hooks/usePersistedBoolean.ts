import { useCallback, useState } from "react";

/**
 * Boolean UI state persisted to localStorage, so layout prefs (collapsed panels) survive a
 * reload. Falls back gracefully when localStorage is unavailable (private mode / SSR).
 */
export function usePersistedBoolean(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initial : raw === "true";
    } catch {
      return initial;
    }
  });

  const set = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, String(next));
      } catch {
        // ignore storage errors
      }
    },
    [key],
  );

  return [value, set];
}
