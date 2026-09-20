import type { AppSettings } from "../../types/settings";

/**
 * Onboarding bookkeeping. Both versions live server-side in `AppSettings` so "first run" belongs
 * to the installation, not to the browser: the dev server (:5173) and the packaged backend (:3001)
 * are different origins, and a localStorage flag would not survive the switch (or a cleared
 * profile). Bumping a version here re-shows that piece to everyone.
 */
export const WIZARD_VERSION = 1;
export const TOUR_VERSION = 1;

/** QA overrides, read once from the URL when the app mounts. */
export interface OnboardingQa {
  /** ?wizard=1 — forces the wizard, ignores and never writes the stored version. */
  wizard: boolean;
  /** ?tour=1 — forces the guide, ignores and never writes the stored version. */
  tour: boolean;
  /** ?tour=1&step=7 — 1-based step into the filtered list (0 = start). */
  step: number;
}

export function readOnboardingQa(search: string): OnboardingQa {
  const params = new URLSearchParams(search);
  const step = Number.parseInt(params.get("step") ?? "", 10);
  return {
    wizard: params.get("wizard") === "1",
    tour: params.get("tour") === "1",
    step: Number.isFinite(step) && step > 0 ? step : 0,
  };
}

/** `null` (never seen) and an older version both mean "still pending". */
function isPending(seen: number | null | undefined, current: number): boolean {
  return typeof seen !== "number" || seen < current;
}

/**
 * The wizard is the only thing that asks for configuration, so it is tied to real state: a
 * provider the app cannot use yet. An existing installation that already has a key never sees it
 * even though its stored version is still null.
 */
export function isWizardPending(settings: AppSettings | null, qa: OnboardingQa, providerNeedsKey: boolean): boolean {
  if (qa.wizard) return true;
  if (!settings) return false;
  if (!isPending(settings.onboardingWizardVersion, WIZARD_VERSION)) return false;
  return providerNeedsKey;
}

/**
 * The guide explains the screen, so it only auto-runs where there is still nothing to explain (no
 * chats) or when the wizard handed over. Anyone else relaunches it from the help menu.
 */
export function isTourPending(settings: AppSettings | null, qa: OnboardingQa, opts: { hasChats: boolean }): boolean {
  if (qa.tour) return true;
  if (!settings) return false;
  if (!isPending(settings.onboardingTourVersion, TOUR_VERSION)) return false;
  return !opts.hasChats;
}
