import { CheckCircle, Lock } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import type { Project, Status } from "../types";

export type StepNo = 1 | 2 | 3 | 4 | 5;
export const STEPS: { no: StepNo; label: string }[] = [
  { no: 1, label: "Describe" },
  { no: 2, label: "Clarify" },
  { no: 3, label: "Requirements" },
  { no: 4, label: "SDLC" },
  { no: 5, label: "Export" },
];

/** Step the server status points at. Steps 5 is only reached by navigation. */
export const stepFor = (s: Status): StepNo => (s === "intake" ? 1 : s === "clarifying" ? 2 : s === "done" ? 4 : 3);

export function unlocked(p: Project | null): Record<StepNo, boolean> {
  if (!p) return { 1: true, 2: false, 3: false, 4: false, 5: false };
  return {
    1: true,
    2: p.status !== "intake",
    3: p.status === "drafting" || p.status === "review" || p.status === "done",
    4: !!p.sdlc,
    5: !!p.sdlc,
  };
}

export function Stepper({ project, current, onGo }: { project: Project | null; current: StepNo; onGo: (n: StepNo) => void }) {
  const open = unlocked(project);
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    // phone layout scrolls horizontally: keep the current step visible
    list.current?.querySelector<HTMLElement>('[aria-current="step"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [current]);
  const reached = project ? stepFor(project.status) : 1;
  return (
    <nav aria-label="Progress" className="lg:sticky lg:top-6 print:hidden">
      <ol ref={list} className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible lg:border-l lg:border-[var(--line)]">
        {STEPS.map(({ no, label }) => {
          const isCurrent = no === current;
          const isDone = open[no] && !isCurrent && (no < reached || (no === 4 && !!project?.sdlc && !project.sdlc.stale));
          return (
            <li key={no} className="shrink-0">
              <button
                type="button"
                aria-current={isCurrent ? "step" : undefined}
                aria-disabled={!open[no]}
                onClick={() => open[no] && onGo(no)}
                className={`relative flex min-h-10 w-full items-center gap-3 rounded-[6px] px-3 py-2 text-left transition-colors lg:rounded-none lg:rounded-r-[6px] ${
                  isCurrent ? "bg-[var(--plum-7)] font-semibold text-plum" : open[no] ? "text-ink hover:bg-[var(--plum-4)]" : "text-steel-ink"
                } ${open[no] ? "" : "cursor-not-allowed"}`}
              >
                {isCurrent && <span className="absolute top-1 bottom-1 left-0 hidden w-[3px] rounded bg-plum lg:block" aria-hidden />}
                <span className="font-mono text-xs tabular-nums">{String(no).padStart(2, "0")}</span>
                <span className="flex-1">{label}</span>
                {!open[no] && <Lock size={14} aria-label="Locked" />}
                {isDone && <CheckCircle size={16} className="text-success-ink" aria-label="Complete" />}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
