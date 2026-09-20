import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../../i18n";
import type { TourContext, TourPlacement } from "./tour.types";
import type { TourStepCopy } from "./tourSteps";

/** Separation between the highlighted element and the card. */
const GAP = 12;
/** Minimum distance the card and the spotlight keep from the viewport edges. */
const EDGE = 8;
/** Breathing room painted around the highlighted element. */
const PAD = 6;
const CARD_WIDTH = "min(22rem, calc(100vw - 2rem))";

type Side = "up" | "down" | "left" | "right";

interface TargetBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface CardPosition {
  left: number;
  top: number;
  arrow: { x: number; y: number; side: Side } | null;
}

const OPPOSITE: Record<Exclude<TourPlacement, "center">, Exclude<TourPlacement, "center">> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** A target that exists but is display:none / zero-sized falls back to a centered card. */
function measureTarget(selector: string | null): TargetBox | null {
  if (!selector) return null;
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return {
    left: rect.left - PAD,
    top: rect.top - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };
}

/**
 * Places the card next to the target, flipping to the opposite side when the requested one does not
 * fit, then clamping to the viewport. The arrow always points at the center of the target and stays
 * inside the card.
 */
function placeCard(
  target: TargetBox | null,
  requested: TourPlacement,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
): CardPosition {
  const centered: CardPosition = {
    left: Math.round((viewport.width - card.width) / 2),
    top: Math.round((viewport.height - card.height) / 2),
    arrow: null,
  };
  if (!target || requested === "center") return centered;

  const room = {
    top: target.top,
    bottom: viewport.height - (target.top + target.height),
    left: target.left,
    right: viewport.width - (target.left + target.width),
  };

  function fits(placement: Exclude<TourPlacement, "center">): boolean {
    if (placement === "top") return room.top >= card.height + GAP + EDGE;
    if (placement === "bottom") return room.bottom >= card.height + GAP + EDGE;
    if (placement === "left") return room.left >= card.width + GAP + EDGE;
    return room.right >= card.width + GAP + EDGE;
  }

  let placement = requested;
  if (!fits(placement) && fits(OPPOSITE[placement])) placement = OPPOSITE[placement];

  const targetCenterX = target.left + target.width / 2;
  const targetCenterY = target.top + target.height / 2;

  // Both axes are always clamped: a target taller (or wider) than the free space leaves no side
  // that fits, and the card would otherwise land outside the viewport. The arrow is computed from
  // the final position, so it keeps pointing at the target after the clamp.
  const clampLeft = (value: number) => clamp(value, EDGE, viewport.width - card.width - EDGE);
  const clampTop = (value: number) => clamp(value, EDGE, viewport.height - card.height - EDGE);

  if (placement === "top" || placement === "bottom") {
    const left = clampLeft(targetCenterX - card.width / 2);
    const top = clampTop(placement === "top" ? target.top - card.height - GAP : target.top + target.height + GAP);
    return {
      left: Math.round(left),
      top: Math.round(top),
      arrow: {
        // Offset inside the card, kept away from the rounded corners.
        x: Math.round(clamp(targetCenterX - left, 16, Math.max(16, card.width - 16))),
        y: placement === "top" ? card.height : 0,
        side: placement === "top" ? "down" : "up",
      },
    };
  }

  const top = clampTop(targetCenterY - card.height / 2);
  const left = clampLeft(placement === "left" ? target.left - card.width - GAP : target.left + target.width + GAP);
  return {
    left: Math.round(left),
    top: Math.round(top),
    arrow: {
      x: placement === "left" ? card.width : 0,
      y: Math.round(clamp(targetCenterY - top, 16, Math.max(16, card.height - 16))),
      side: placement === "left" ? "right" : "left",
    },
  };
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface Props {
  steps: TourStepCopy[];
  ctx: TourContext;
  /** 1-based step from `?tour=1&step=N`, already resolved against the filtered list. */
  startStep?: number;
  onExit: (reason: "done" | "skip") => void;
}

/**
 * First-run guide: dims everything except one element and explains it with a card. Hand-rolled
 * (getBoundingClientRect + a shadow-based spotlight) so the project keeps its zero-dependency rule.
 */
export function OnboardingTour({ steps, ctx, startStep = 0, onExit }: Props) {
  const t = useT();
  const [index, setIndex] = useState(() => clamp(startStep - 1, 0, Math.max(steps.length - 1, 0)));
  const [target, setTarget] = useState<TargetBox | null>(null);
  const [card, setCard] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  // `before` and the measurements read the context through a ref: App rebuilds it every render and
  // a changing identity must not restart the step.
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const step = steps[index];
  const isLast = index === steps.length - 1;

  const measure = useCallback(() => {
    const selector = steps[index]?.target ?? null;
    if (!selector) {
      setTarget(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(selector);
    if (el) el.scrollIntoView({ block: "center", inline: "nearest", behavior: prefersReducedMotion() ? "instant" : "auto" });
    setTarget(measureTarget(selector));
  }, [steps, index]);

  // Enter a step: let the app open panels/menus first, then measure. React setters are async and
  // the panel only exists on the next frame, so we wait for two frames (plus two late re-reads to
  // catch font loading and any layout that settles after the first paint).
  useEffect(() => {
    let cancelled = false;
    setTarget(null);
    void (async () => {
      const run = steps[index];
      run?.before?.(ctxRef.current);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (cancelled) return;
      measure();
      window.setTimeout(() => {
        if (!cancelled) measure();
      }, 140);
      window.setTimeout(() => {
        if (!cancelled) measure();
      }, 320);
    })();
    return () => {
      cancelled = true;
    };
  }, [index, steps, measure]);

  // Keep the spotlight glued to its element while the page moves or the element resizes.
  useEffect(() => {
    function handle() {
      measure();
    }
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, { passive: true, capture: true });
    const el = step?.target ? document.querySelector<HTMLElement>(step.target) : null;
    const observer = el ? new ResizeObserver(handle) : null;
    if (el && observer) observer.observe(el);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
      observer?.disconnect();
    };
  }, [step, measure]);

  useLayoutEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const update = () => setCard({ width: node.offsetWidth, height: node.offsetHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [index, steps]);

  useEffect(() => {
    primaryRef.current?.focus();
  }, [index]);

  function go(delta: number) {
    setIndex((current) => clamp(current + delta, 0, steps.length - 1));
  }

  function exit(reason: "done" | "skip") {
    onExit(reason);
  }

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        exit("skip");
        return;
      }
      if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        if (isLast) exit("done");
        else go(1);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLast, steps.length]);

  if (!step) return null;

  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const position = placeCard(target, step.placement, card, viewport);
  const reduced = prefersReducedMotion();

  return createPortal(
    <div
      className="sg-tour"
      role="dialog"
      aria-modal="true"
      aria-label={t("onboarding.tour.ariaLabel", { title: t(step.titleKey) })}
      data-tour-step={step.id}
    >
      {target ? (
        <div
          className="sg-tour__spotlight"
          style={{ left: target.left, top: target.top, width: target.width, height: target.height }}
        />
      ) : (
        <div className="sg-tour__backdrop" />
      )}

      <div
        ref={cardRef}
        className={`sg-tour__card ${reduced ? "" : "sg-tour__card--enter"}`}
        style={{ left: position.left, top: position.top, width: CARD_WIDTH }}
      >
        {position.arrow && (
          <span
            className={`sg-tour__arrow sg-tour__arrow--${position.arrow.side}`}
            style={{ left: position.arrow.x, top: position.arrow.y }}
            aria-hidden="true"
          />
        )}

        <span className="sg-tour__kicker">
          {t("onboarding.progress", { current: index + 1, total: steps.length })}
        </span>
        <h2 className="sg-tour__title">{t(step.titleKey)}</h2>
        <p className="sg-tour__body">{t(step.bodyKey)}</p>
        {step.bulletsKeys && (
          <ul className="sg-tour__bullets">
            {step.bulletsKeys.map((bulletKey) => (
              <li key={bulletKey}>{t(bulletKey)}</li>
            ))}
          </ul>
        )}

        {step.actions && (
          <div className="sg-tour__actions">
            {step.actions.map((action) => (
              <button
                key={action.labelKey}
                type="button"
                onClick={() => action.run(ctxRef.current)}
                className={`sg-tour__button ${action.kind === "secondary" ? "sg-tour__button--ghost" : "sg-tour__button--primary"}`}
              >
                {t(action.labelKey)}
              </button>
            ))}
          </div>
        )}

        <div className="sg-tour__footer">
          <button type="button" onClick={() => exit("skip")} className="sg-tour__skip">
            {t("onboarding.tour.skip")}
          </button>
          <div className="sg-tour__nav">
            <button type="button" onClick={() => go(-1)} disabled={index === 0} className="sg-tour__button sg-tour__button--ghost">
              {t("onboarding.nav.previous")}
            </button>
            <button
              ref={primaryRef}
              type="button"
              onClick={() => (isLast ? exit("done") : go(1))}
              className="sg-tour__button sg-tour__button--primary"
            >
              {isLast ? t("onboarding.nav.done") : t("onboarding.nav.next")}
            </button>
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {t("onboarding.tour.live", { current: index + 1, total: steps.length, title: t(step.titleKey) })}
      </p>
    </div>,
    document.body,
  );
}
