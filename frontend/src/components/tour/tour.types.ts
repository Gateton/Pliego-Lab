import type { ModalId } from "../../App";

export type TourPlacement = "top" | "bottom" | "left" | "right" | "center";

/**
 * What the guide is allowed to do to the app. App owns the state; the tour never touches a setter
 * directly, so opening a menu or a panel from a step is always something the app opted into.
 */
export interface TourContext {
  hasCharacters: boolean;
  hasChat: boolean;
  comfyInjectEnabled: boolean;
  usageEnabled: boolean;
  /** Expands/collapses side panels. `undefined` leaves a side untouched. */
  focusPanels: (opts: { left?: boolean; right?: boolean }) => void;
  /** Puts the panels back the way they were before the guide started. */
  restorePanels: () => void;
  /** Left panel tab. */
  setLeftTab: (tab: "respuesta" | "comfyinject") => void;
  /** Opens/closes the top bar "⋮" menu (controlled mode). */
  setTopMenuOpen: (open: boolean) => void;
  /** Opens/closes the chat "Vista" menu (controlled mode). */
  setViewMenuOpen: (open: boolean) => void;
  /** Opens a full-screen config overlay, or closes the current one with null. */
  openModal: (id: ModalId) => void;
  /** Closes the guide without touching the remaining steps (used by a CTA). */
  finish: () => void;
}

export interface TourStep {
  id: string;
  /** CSS selector over a `data-tour` anchor. null = centered card with no arrow. */
  target: string | null;
  placement: TourPlacement;
  title: string;
  body: string;
  /** Optional short bullets under the body, for adjacent buttons or lists. */
  bullets?: string[];
  /** false drops the step entirely, so the "Paso N de M" counter stays honest. */
  when?: (ctx: TourContext) => boolean;
  /** Runs before measuring: opens panels, switches tabs, opens a menu. */
  before?: (ctx: TourContext) => void;
  /** Extra buttons above the footer, e.g. the import call to action. */
  actions?: { label: string; kind?: "primary" | "secondary"; run: (ctx: TourContext) => void }[];
}
