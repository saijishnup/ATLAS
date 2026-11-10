import { Question } from "@phosphor-icons/react";
import { useEffect, useId, useRef } from "react";
import { resetTour, skipAllTours, startTour, stopTour, type TourStep } from "../tour";
import { useToast } from "./Toast";

const popoverAttr = { popover: "auto" } as Record<string, string>;

export function HelpMenu({ step }: { step?: TourStep }) {
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    const el = pop.current;
    if (!el) return;
    const place = (e: Event) => {
      if ((e as ToggleEvent).newState !== "open" || !btn.current) return;
      const r = btn.current.getBoundingClientRect();
      el.style.top = `${r.bottom + 6}px`;
      el.style.left = `${Math.max(8, Math.min(r.right - el.offsetWidth, window.innerWidth - el.offsetWidth - 8))}px`;
    };
    el.addEventListener("toggle", place);
    return () => el.removeEventListener("toggle", place);
  }, []);

  const close = () => pop.current?.hidePopover();
  const item = "flex min-h-10 w-full items-center rounded-[6px] px-3 text-left hover:bg-[var(--plum-4)]";

  return (
    <>
      <button ref={btn} type="button" className="btn btn-ghost min-h-10 px-3" {...({ popovertarget: id } as Record<string, string>)}>
        <Question size={16} aria-hidden /> Help
      </button>
      <div ref={pop} id={id} {...popoverAttr} className="panel m-0 w-64 p-1" style={{ position: "fixed", inset: "auto" }}>
        {step && (
          <button className={item} onClick={() => { close(); startTour(step, true); }}>
            Replay this step
          </button>
        )}
        <button
          className={item}
          onClick={() => {
            close();
            resetTour();
            if (step) startTour(step, true);
            else toast("Tour will replay as you reach each step");
          }}
        >
          Replay tour from the start
        </button>
        <button className={item} onClick={() => { close(); skipAllTours(); toast("Tour skipped. Replay it from this menu."); }}>
          Skip the tour
        </button>
        <button className={`${item} text-steel-ink`} onClick={() => { close(); stopTour(); }}>
          Close the current tip
        </button>
      </div>
    </>
  );
}
