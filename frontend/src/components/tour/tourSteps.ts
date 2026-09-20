import type { TranslationKey } from "../../i18n";
import type { TourContext, TourStep } from "./tour.types";

/**
 * The first-run guide script, in the order a new user meets the app: what this is, your own stuff
 * (library, panels, chat), then every tool in the top bar, and finally the way back in.
 *
 * Copy rules: Spanish rioplatense, "vos", no emojis, two sentences per step at most. English keeps
 * the same register in short sentences, without "vos". Every claim here has to match what the panel
 * actually does — if a feature changes, this file changes with it.
 *
 * The copy travels as catalog keys, not as resolved text: App builds the steps once per context and
 * `OnboardingTour` resolves them on every render, so switching language re-renders the guide in the
 * new language instead of leaving the old one on screen.
 */
export interface TourStepCopy extends Omit<TourStep, "title" | "body" | "bullets" | "actions"> {
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  bulletsKeys?: TranslationKey[];
  actions?: { labelKey: TranslationKey; kind?: "primary" | "secondary"; run: (ctx: TourContext) => void }[];
}

export function buildTourSteps(ctx: TourContext): TourStepCopy[] {
  const steps: TourStepCopy[] = [
    {
      id: "welcome",
      target: null,
      placement: "center",
      titleKey: "onboarding.tour.steps.welcome.title",
      bodyKey: "onboarding.tour.steps.welcome.body",
    },
    {
      id: "brand",
      target: '[data-tour="brand"]',
      placement: "bottom",
      titleKey: "onboarding.tour.steps.brand.title",
      bodyKey: "onboarding.tour.steps.brand.body",
    },
    {
      id: "topbar",
      target: '[data-tour="topbar-actions"]',
      placement: "bottom",
      titleKey: "onboarding.tour.steps.topbar.title",
      bodyKey: "onboarding.tour.steps.topbar.body",
    },
    {
      id: "library",
      target: '[data-tour="library"]',
      placement: "left",
      titleKey: "onboarding.tour.steps.library.title",
      bodyKey: "onboarding.tour.steps.library.body",
      bulletsKeys: [
        "onboarding.tour.steps.library.bullet1",
        "onboarding.tour.steps.library.bullet2",
        "onboarding.tour.steps.library.bullet3",
      ],
      before: (tour) => tour.focusPanels({ right: true, left: false }),
    },
    {
      id: "library-empty",
      target: '[data-tour="library-actions"]',
      placement: "left",
      titleKey: "onboarding.tour.steps.libraryEmpty.title",
      bodyKey: "onboarding.tour.steps.libraryEmpty.body",
      when: (tour) => !tour.hasCharacters,
    },
    {
      id: "library-actions",
      target: '[data-tour="library-actions"]',
      placement: "left",
      titleKey: "onboarding.tour.steps.libraryActions.title",
      bodyKey: "onboarding.tour.steps.libraryActions.body",
      when: (tour) => tour.hasCharacters,
    },
    {
      id: "respuesta-panel",
      target: '[data-tour="panel-respuesta"]',
      placement: "right",
      titleKey: "onboarding.tour.steps.responsePanel.title",
      bodyKey: "onboarding.tour.steps.responsePanel.body",
      bulletsKeys: ["onboarding.tour.steps.responsePanel.bullet1", "onboarding.tour.steps.responsePanel.bullet2"],
      before: (tour) => {
        tour.focusPanels({ left: true, right: false });
        tour.setLeftTab("respuesta");
      },
    },
    {
      id: "comfyinject-tab",
      target: '[data-tour="tab-comfyinject"]',
      placement: "bottom",
      titleKey: "onboarding.tour.steps.comfyInjectTab.title",
      bodyKey: "onboarding.tour.steps.comfyInjectTab.body",
      when: (tour) => tour.comfyInjectEnabled,
      before: (tour) => tour.setLeftTab("comfyinject"),
    },
    {
      id: "chat-header",
      target: '[data-tour="chat-header"]',
      placement: "bottom",
      titleKey: "onboarding.tour.steps.chatHeader.title",
      bodyKey: "onboarding.tour.steps.chatHeader.body",
      when: (tour) => tour.hasChat,
      before: (tour) => {
        tour.setLeftTab("respuesta");
        tour.focusPanels({ left: false, right: false });
      },
    },
    {
      id: "chat-empty",
      target: null,
      placement: "center",
      titleKey: "onboarding.tour.steps.chatEmpty.title",
      bodyKey: "onboarding.tour.steps.chatEmpty.body",
      when: (tour) => !tour.hasChat,
      before: (tour) => tour.focusPanels({ left: false, right: true }),
    },
    {
      // The thread fills most of the screen, so there is no side with room for the card: the
      // spotlight still marks the whole area and the card sits centered without an arrow.
      id: "chat-thread",
      target: '[data-tour="chat-thread"]',
      placement: "center",
      titleKey: "onboarding.tour.steps.chatThread.title",
      bodyKey: "onboarding.tour.steps.chatThread.body",
      when: (tour) => tour.hasChat,
    },
    {
      // Anchored on the open panel, not the button: that way the card never covers the menu the
      // step is explaining.
      id: "view-menu",
      target: '[data-tour="view-menu-panel"]',
      placement: "left",
      titleKey: "onboarding.tour.steps.viewMenu.title",
      bodyKey: "onboarding.tour.steps.viewMenu.body",
      when: (tour) => tour.hasChat,
      before: (tour) => tour.setViewMenuOpen(true),
    },
    {
      id: "chat-buttons",
      target: '[data-tour="chat-tools"]',
      placement: "bottom",
      titleKey: "onboarding.tour.steps.chatButtons.title",
      bodyKey: "onboarding.tour.steps.chatButtons.body",
      when: (tour) => tour.hasChat,
      before: (tour) => tour.setViewMenuOpen(false),
    },
    {
      id: "composer",
      target: '[data-tour="composer"]',
      placement: "top",
      titleKey: "onboarding.tour.steps.composer.title",
      bodyKey: "onboarding.tour.steps.composer.body",
      bulletsKeys: [
        "onboarding.tour.steps.composer.bullet1",
        "onboarding.tour.steps.composer.bullet2",
        "onboarding.tour.steps.composer.bullet3",
      ],
      when: (tour) => tour.hasChat,
    },
    {
      id: "presets",
      target: '[data-tour="btn-presets"]',
      placement: "bottom",
      titleKey: "onboarding.tour.steps.presets.title",
      bodyKey: "onboarding.tour.steps.presets.body",
      before: (tour) => tour.focusPanels({ left: false, right: false }),
    },
    {
      id: "personas",
      target: '[data-tour="btn-personas"]',
      placement: "bottom",
      titleKey: "onboarding.tour.steps.personas.title",
      bodyKey: "onboarding.tour.steps.personas.body",
    },
    {
      id: "lorebooks",
      target: '[data-tour="btn-lorebooks"]',
      placement: "bottom",
      titleKey: "onboarding.tour.steps.lorebooks.title",
      bodyKey: "onboarding.tour.steps.lorebooks.body",
    },
    {
      id: "character-creator",
      target: '[data-tour="btn-character-creator"]',
      placement: "bottom",
      titleKey: "onboarding.tour.steps.characterCreator.title",
      bodyKey: "onboarding.tour.steps.characterCreator.body",
    },
    {
      id: "director",
      target: '[data-tour="btn-director"]',
      placement: "bottom",
      titleKey: "onboarding.tour.steps.director.title",
      bodyKey: "onboarding.tour.steps.director.body",
    },
    {
      id: "comfyinject",
      target: '[data-tour="btn-comfyinject"]',
      placement: "bottom",
      titleKey: "onboarding.tour.steps.comfyInject.title",
      bodyKey: "onboarding.tour.steps.comfyInject.body",
    },
    {
      id: "estudio",
      target: '[data-tour="btn-estudio"]',
      placement: "bottom",
      titleKey: "onboarding.tour.steps.estudio.title",
      bodyKey: "onboarding.tour.steps.estudio.body",
    },
    {
      id: "gateton-rp",
      target: '[data-tour="btn-gateton-rp"]',
      placement: "bottom",
      titleKey: "onboarding.tour.steps.gatetonRp.title",
      bodyKey: "onboarding.tour.steps.gatetonRp.body",
    },
    {
      id: "recast",
      target: '[data-tour="btn-recast"]',
      placement: "bottom",
      titleKey: "onboarding.tour.steps.recast.title",
      bodyKey: "onboarding.tour.steps.recast.body",
    },
    {
      id: "npc",
      target: '[data-tour="btn-npc"]',
      placement: "bottom",
      titleKey: "onboarding.tour.steps.npc.title",
      bodyKey: "onboarding.tour.steps.npc.body",
    },
    {
      id: "usage",
      target: '[data-tour="btn-usage"]',
      placement: "bottom",
      titleKey: "onboarding.tour.steps.usage.title",
      bodyKey: "onboarding.tour.steps.usage.body",
      when: (tour) => tour.usageEnabled,
    },
    {
      id: "more-menu",
      target: '[data-tour="menu-more"]',
      placement: "bottom",
      titleKey: "onboarding.tour.steps.moreMenu.title",
      bodyKey: "onboarding.tour.steps.moreMenu.body",
      before: (tour) => tour.setTopMenuOpen(true),
      actions: [
        {
          labelKey: "onboarding.tour.steps.moreMenu.importNow",
          kind: "primary",
          run: (tour) => {
            tour.finish();
            tour.openModal("importst");
          },
        },
        {
          labelKey: "onboarding.tour.steps.moreMenu.later",
          kind: "secondary",
          run: (tour) => tour.setTopMenuOpen(false),
        },
      ],
    },
    {
      id: "settings",
      target: '[data-tour="menu-settings"]',
      placement: "right",
      titleKey: "onboarding.tour.steps.settings.title",
      bodyKey: "onboarding.tour.steps.settings.body",
      before: (tour) => tour.setTopMenuOpen(true),
    },
    {
      id: "done",
      target: null,
      placement: "center",
      titleKey: "onboarding.tour.steps.done.title",
      bodyKey: "onboarding.tour.steps.done.body",
      before: (tour) => {
        tour.setTopMenuOpen(false);
        tour.restorePanels();
      },
      actions: [{ labelKey: "onboarding.tour.steps.done.startWriting", kind: "primary", run: (tour) => tour.finish() }],
    },
  ];

  // Conditional steps are dropped here (not hidden later) so the footer counter is always right.
  return steps.filter((step) => !step.when || step.when(ctx));
}
