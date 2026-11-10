import { driver, type DriveStep } from "driver.js";
import { useEffect } from "react";
import { help } from "./help";

export type TourStep = "describe" | "clarify" | "requirements" | "sdlc" | "export";
export const TOUR_STEPS: TourStep[] = ["describe", "clarify", "requirements", "sdlc", "export"];

// Stops per step (spec section 7). `data-tour` attributes live on the step components; copy comes from help.ts.
const STOPS: Record<TourStep, { sel: string; help: string }[]> = {
  describe: [
    { sel: "describe-type", help: "type" },
    { sel: "describe-description", help: "description" },
    { sel: "describe-traits", help: "traits" },
    { sel: "describe-sample", help: "sample" },
  ],
  clarify: [
    { sel: "clarify-question", help: "q_why" },
    { sel: "clarify-skip", help: "q_skip" },
  ],
  requirements: [
    { sel: "req-list", help: "req_list" },
    { sel: "req-flags", help: "req_flags" },
    { sel: "req-confidence", help: "req_confidence" },
    { sel: "req-actions", help: "req_actions" },
  ],
  sdlc: [
    { sel: "sdlc-top", help: "sdlc_top" },
    { sel: "sdlc-factors", help: "sdlc_factors" },
    { sel: "sdlc-compare", help: "sdlc_compare" },
  ],
  export: [{ sel: "export-download", help: "export_download" }],
};

const key = (s: TourStep) => `atlas.tour.${s}`;
const seen = (s: TourStep) => {
  try {
    return localStorage.getItem(key(s)) === "1";
  } catch {
    return false; // storage blocked: behave as first visit, never crash
  }
};
const mark = (s: TourStep) => {
  try {
    localStorage.setItem(key(s), "1");
  } catch {
    /* ignore */
  }
};

let active: ReturnType<typeof driver> | null = null;

export function stopTour() {
  active?.destroy();
  active = null;
}

/** Runs the mini tour for one step. Only on first visit unless `force`. Stops whose element is missing are skipped. */
export function startTour(step: TourStep, force = false) {
  if (!force && seen(step)) return;
  stopTour();
  const steps: DriveStep[] = STOPS[step]
    .filter((s) => document.querySelector(`[data-tour="${s.sel}"]`) && help[s.help])
    .map((s) => ({
      element: `[data-tour="${s.sel}"]`,
      popover: { title: help[s.help].title, description: help[s.help].body, side: "bottom", align: "start" },
    }));
  if (steps.length === 0) return;

  const d = driver({
    steps,
    showProgress: steps.length > 1,
    progressText: "{{current}} of {{total}}",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    allowClose: true,
    smoothScroll: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    stagePadding: 6,
    stageRadius: 8,
    overlayColor: "#152935",
    overlayOpacity: 0.55,
    onPopoverRender: (popover) => {
      const skip = document.createElement("button");
      skip.type = "button";
      skip.textContent = "Skip";
      skip.setAttribute("aria-label", "Skip this tour");
      skip.onclick = () => d.destroy();
      popover.footerButtons.prepend(skip);
    },
    onDestroyed: () => {
      mark(step); // finished or skipped: do not show again
      if (active === d) active = null;
    },
  });
  active = d;
  d.drive();
}

/** Call from a step component once its `data-tour` targets are rendered. */
export function useTour(step: TourStep, ready = true) {
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => startTour(step), 450);
    return () => {
      clearTimeout(t);
      stopTour();
    };
  }, [step, ready]);
}

export function resetTour() {
  try {
    TOUR_STEPS.forEach((s) => localStorage.removeItem(key(s)));
  } catch {
    /* ignore */
  }
}
export function skipAllTours() {
  stopTour();
  TOUR_STEPS.forEach(mark);
}
