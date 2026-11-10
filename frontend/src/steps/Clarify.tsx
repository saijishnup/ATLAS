import { ArrowRight, SkipForward } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { answer } from "../api";
import { ErrorBanner } from "../components/ErrorBanner";
import { Info } from "../components/Info";
import { Skeleton } from "../components/Skeleton";
import { StageTracker } from "../components/StageTracker";
import { localHint, useLlmStatus } from "../hooks/useLlmStatus";
import { useMeta } from "../hooks/useMeta";
import { useTour } from "../tour";
import type { Question } from "../types";
import type { StepProps } from "./props";

const LEVELS = ["low", "medium", "high"] as const;

export default function Clarify({ project, run, busy }: StepProps) {
  const { meta, error, retry } = useMeta();
  const hint = localHint(useLlmStatus());
  const [values, setValues] = useState<Record<number, string>>({});
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState<"continue" | "more" | null>(null);

  const latest = useMemo(() => Math.max(0, ...project.questions.map((q) => q.round)), [project.questions]);
  const editable = (q: Question) => project.status === "clarifying" && q.round === latest && q.answer === null && !q.skipped;
  const active = project.questions.filter(editable);
  const factorIds = new Set(meta?.clarified.map((c) => c.id));
  useTour("clarify", !!meta && active.length > 0);

  if (error) return <ErrorBanner error={error} onRetry={retry} />;
  if (!meta) return <Skeleton rows={4} label="Loading questions" />;

  const submit = (more: boolean) => {
    setPending(more ? "more" : "continue");
    const payload = active.map((q) => {
      const v = (values[q.id] ?? "").trim();
      return { id: q.id, answer: skipped.has(q.id) || !v ? null : v }; // blank counts as skipped
    });
    void run(() => answer(project.id, payload, more));
  };

  const toggleSkip = (id: number) =>
    setSkipped((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <section aria-labelledby="clar-h" className="max-w-[760px]">
      <h1 id="clar-h">Follow-up questions</h1>
      <p className="mt-1 flex items-center gap-1 text-steel-ink">
        {project.questions.length === 0
          ? "No follow-up questions were needed."
          : active.length > 0
            ? `Round ${latest} of 2. Answer what you can and skip the rest.`
            : "Answers recorded."}
        <Info id="q_why" />
      </p>

      <ol className="panel mt-6 divide-y divide-[var(--line)]">
        {project.questions.map((q, i) => {
          const isActive = editable(q);
          const isFactor = factorIds.has(q.topic);
          const factor = meta.clarified.find((c) => c.id === q.topic);
          const isSkipped = skipped.has(q.id);
          return (
            <li key={q.id} className="px-4 py-4" data-tour={i === 0 ? "clarify-question" : undefined}>
              <div className="flex gap-3">
                <span className="mt-0.5 font-mono text-xs text-steel-ink tabular-nums">Q{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{q.text}</p>
                  <p className="mt-0.5 text-sm text-steel-ink">Why we ask: {q.why}</p>

                  {isActive ? (
                    <div className="mt-3 flex flex-col items-start gap-2">
                      {isFactor ? (
                        <div role="radiogroup" aria-label={q.text} className="inline-grid grid-cols-3 overflow-hidden rounded-[6px] border border-[var(--line)]">
                          {LEVELS.map((l) => (
                            <label key={l} className="relative">
                              <input type="radio" name={`q${q.id}`} value={l} disabled={isSkipped} checked={values[q.id] === l} onChange={() => setValues((v) => ({ ...v, [q.id]: l }))} className="peer sr-only" />
                              <span className="flex min-h-10 min-w-28 flex-col items-center justify-center border-l border-[var(--line)] px-3 py-1 text-sm first:border-l-0 hover:bg-[var(--plum-4)] peer-checked:bg-plum peer-checked:text-canvas peer-disabled:opacity-40 peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-plum">
                                <span className="font-medium capitalize">{l}</span>
                                <span className="text-xs opacity-80">{factor?.levels[l]}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <textarea rows={3} className="field w-full resize-y disabled:opacity-50" aria-label={`Answer to: ${q.text}`} disabled={isSkipped} value={values[q.id] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [q.id]: e.target.value }))} />
                      )}
                      <button type="button" className="btn btn-ghost min-h-10 text-sm" onClick={() => toggleSkip(q.id)} aria-pressed={isSkipped} data-tour={i === 0 ? "clarify-skip" : undefined}>
                        <SkipForward size={16} aria-hidden /> {isSkipped ? "Undo skip" : "Skip (not sure)"}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 rounded-[6px] bg-[var(--plum-4)] px-3 py-2">
                      {q.skipped || q.answer === null ? <span className="text-steel-ink">Skipped (treated as not sure)</span> : q.answer}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {active.length > 0 && (
        <div className="mt-6">
          {busy ? (
            <StageTracker stages={pending === "more" ? ["Saving answers", "Clarification agent"] : ["Saving answers"]} hint={pending === "more" ? hint : undefined} />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button className="btn btn-primary" onClick={() => submit(false)}>
                Continue <ArrowRight size={16} aria-hidden />
              </button>
              {latest === 1 && (
                <button className="btn btn-ghost" onClick={() => submit(true)}>
                  Ask more questions
                </button>
              )}
              <span className="text-sm text-steel-ink flex items-center gap-1">Skipped questions count as not sure <Info id="q_skip" /></span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
