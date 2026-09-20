import { useCallback, useState } from "react";
import { t } from "../../i18n";

function describeFailure(failure: unknown): string {
  return failure instanceof Error ? failure.message : t("memory.action.failed");
}

export type ActionOutcome<Result> =
  | { ok: true; value: Result }
  | { ok: false; error: string };

/**
 * Runs one panel action while tracking whether it is in flight and keeping the failure as an
 * inline message. Every callback prop of the panel is optional, so a missing one is reported in
 * the same place as a rejected call instead of crashing the tab.
 */
export function useMemoryAction<Args extends unknown[], Result>(
  action?: (...args: Args) => Promise<Result>,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const run = useCallback(async (...args: Args): Promise<ActionOutcome<Result>> => {
    if (!action) {
      const message = t("memory.action.notConnected");
      setError(message);
      return { ok: false, error: message };
    }
    setBusy(true);
    setError(null);
    try {
      return { ok: true, value: await action(...args) };
    } catch (failure) {
      const message = describeFailure(failure);
      setError(message);
      return { ok: false, error: message };
    } finally {
      setBusy(false);
    }
  }, [action]);

  return { busy, error, run, clearError };
}
