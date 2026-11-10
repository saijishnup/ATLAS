import { Info as InfoIcon } from "@phosphor-icons/react";
import { useEffect, useId, useRef } from "react";
import { help } from "../help";

// React 18 types do not know the native Popover API attributes yet.
const popoverAttr = { popover: "auto" } as Record<string, string>;
const triggerAttr = (id: string) => ({ popovertarget: id }) as Record<string, string>;

/** `[i]` help. Native popover: Esc and click-outside close for free. Positioned by hand (about 15 lines). */
export function Info({ id }: { id: string }) {
  const h = help[id];
  const popId = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = pop.current;
    if (!el) return;
    const place = (e: Event) => {
      if ((e as ToggleEvent).newState !== "open" || !btn.current) return;
      const r = btn.current.getBoundingClientRect();
      const w = el.offsetWidth, hgt = el.offsetHeight, pad = 8;
      el.style.left = `${Math.max(pad, Math.min(r.left, window.innerWidth - w - pad))}px`;
      el.style.top = `${r.bottom + 6 + hgt <= window.innerHeight ? r.bottom + 6 : Math.max(pad, r.top - 6 - hgt)}px`;
    };
    el.addEventListener("toggle", place);
    return () => el.removeEventListener("toggle", place);
  }, []);

  if (!h) return null;

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={`About ${h.title}`}
        {...triggerAttr(popId)}
        className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-steel-ink transition-colors before:absolute before:-inset-2.5 before:content-[''] hover:bg-[var(--plum-7)] hover:text-plum"
      >
        <InfoIcon size={16} aria-hidden />
      </button>
      <span
        ref={pop}
        id={popId}
        {...popoverAttr}
        className="panel m-0 w-[min(320px,calc(100vw-16px))] p-4 text-left text-sm leading-normal font-normal tracking-normal text-ink normal-case"
        style={{ position: "fixed", inset: "auto" }}
      >
        <span className="block font-semibold">{h.title}</span>
        <span className="mt-1 block text-steel-ink">{h.body}</span>
      </span>
    </>
  );
}
