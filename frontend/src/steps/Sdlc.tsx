import { ArrowRight, Scales, Warning } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Chip } from "../components/Chip";
import { Info } from "../components/Info";
import { useTour } from "../tour";
import type { FactorRow, Note, RankRow, SdlcRun } from "../types";
import type { StepProps } from "./props";

const TAG_TONE = { "user-stated": "success", inferred: "warning", "not sure": "neutral" } as const;

export default function Sdlc({ project, onNext, onGoRequirements }: StepProps & { onNext?: () => void; onGoRequirements?: () => void }) {
  const s = project.sdlc as SdlcRun;
  const [picked, setPicked] = useState<string[]>([]);
  useTour("sdlc");

  const notes = useMemo(() => {
    const m = new Map<string, Note>();
    [...s.rationale.top, ...s.rationale.why_not].forEach((n) => m.set(n.model, n));
    return m;
  }, [s]);
  const labels = useMemo(() => Object.fromEntries(s.factors.map((f) => [f.factor, f.label])), [s]);
  const [first, second, third] = s.ranking;

  const toggle = (model: string) =>
    setPicked((p) => (p.includes(model) ? p.filter((m) => m !== model) : p.length < 2 ? [...p, model] : p));
  // Scores within 2 points are treated as ties and ordered by lifecycle family, so rank is not always score order.
  const tied = s.ranking.some((r, i) => i > 0 && r.score > s.ranking[i - 1].score);
  const pair = picked.map((m) => s.ranking.find((r) => r.model === m)!).filter(Boolean);

  return (
    <section aria-labelledby="sdlc-h" className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="sdlc-h">SDLC recommendation</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-steel-ink">
            <Chip tone="warning" icon={<Scales size={14} aria-hidden />}>Expert-judgement fit matrix</Chip>
            <Info id="matrix_note" />
          </p>
        </div>
        <button className="btn btn-primary" onClick={onNext}>
          Continue to export <ArrowRight size={16} aria-hidden />
        </button>
      </header>

      {s.stale && (
        <div role="status" className="panel flex flex-wrap items-center gap-3 border-warning px-4 py-3 text-warning-ink">
          <Warning size={18} aria-hidden />
          <span className="flex-1">Requirements changed after this result. It is stale until you run the analysis again.</span>
          <button className="btn btn-ghost" onClick={onGoRequirements}>Go to requirements</button>
        </div>
      )}

      {/* 1. result */}
      <div data-tour="sdlc-top">
        <div className="mb-3 flex items-center gap-1">
          <h2>Result</h2>
          <Info id="sdlc_top" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <article className="panel p-6" aria-label={`Top recommendation: ${first.name}`}>
            <p className="eyebrow">Best fit</p>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-[28px] leading-tight font-semibold tracking-tight">{first.name}</h3>
              <span className="font-mono text-[28px] font-semibold tabular-nums">{first.score.toFixed(1)}</span>
            </div>
            <NoteBlock note={notes.get(first.model)} />
          </article>
          <div className="grid gap-4">
            {[second, third].filter(Boolean).map((r) => (
              <article key={r.model} className="panel p-4" aria-label={`Rank ${r.rank}: ${r.name}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <p><span className="mr-2 font-mono text-xs text-steel-ink">#{r.rank}</span><span className="font-semibold">{r.name}</span></p>
                  <span className="font-mono tabular-nums">{r.score.toFixed(1)}</span>
                </div>
                <NoteBlock note={notes.get(r.model)} compact />
              </article>
            ))}
          </div>
        </div>
        {s.rationale.summary && <p className="mt-4 max-w-[75ch]">{s.rationale.summary}</p>}
        {s.confidence && <p className="mt-2 text-steel-ink">{s.confidence.text}</p>}
        {tied && (
          <p className="mt-2 flex items-start gap-1 text-steel-ink">
            Scores within 2 points count as ties and are ordered by lifecycle family, then name. A lower score can rank higher.
            <Info id="tie_rule" />
          </p>
        )}
      </div>

      {/* 2. factors */}
      <div data-tour="sdlc-factors">
        <div className="mb-3 flex items-center gap-1">
          <h2>Factors used</h2>
          <Info id="sdlc_factors" />
        </div>
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <caption className="sr-only">Ten SDLC factors, their level and where each value came from</caption>
            <thead className="border-b border-[var(--line)] text-xs text-steel-ink">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Factor</th>
                <th scope="col" className="px-4 py-2 font-medium">Level</th>
                <th scope="col" className="px-4 py-2 font-medium">Source</th>
                <th scope="col" className="px-4 py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {s.factors.map((f) => <FactorLine key={f.factor} f={f} />)}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. ranking + compare */}
      <div data-tour="sdlc-compare">
        <div className="mb-1 flex items-center gap-1">
          <h2>All models</h2>
          <Info id="sdlc_compare" />
        </div>
        <p className="mb-3 text-steel-ink">
          {picked.length === 1 ? "Tick one more model to compare." : "Tick two models to compare them. Open a row for its explanation."}
        </p>
        {pair.length === 2 && <Compare a={pair[0]} b={pair[1]} labels={labels} onClear={() => setPicked([])} />}
        <ul className="panel divide-y divide-[var(--line)]">
          {s.ranking.map((r) => (
            <RankLine key={r.model} r={r} note={notes.get(r.model)} checked={picked.includes(r.model)} disabled={!picked.includes(r.model) && picked.length >= 2} onToggle={() => toggle(r.model)} />
          ))}
        </ul>

      </div>
    </section>
  );
}

function NoteBlock({ note, compact }: { note?: Note; compact?: boolean }) {
  if (!note) return null;
  return (
    <div className={compact ? "mt-2" : "mt-4"}>
      <p className={`${compact ? "text-sm" : ""} max-w-[70ch] break-words`}>{note.text}</p>
      <p className="mt-2 flex flex-wrap items-center gap-1.5">
        <Chip>{note.source === "llm" ? "LLM explanation" : "Rule-based"}</Chip>
        {note.cards.map((c) => <Chip key={c} mono>{c}</Chip>)}
      </p>
    </div>
  );
}

function FactorLine({ f }: { f: FactorRow }) {
  return (
    <tr className="align-top">
      <th scope="row" className="px-4 py-2.5 font-medium">{f.label}</th>
      <td className="px-4 py-2.5 capitalize">{f.level}</td>
      <td className="px-4 py-2.5"><Chip tone={TAG_TONE[f.tag]}>{f.tag}</Chip></td>
      <td className="px-4 py-2.5 text-steel-ink">
        {f.conflict ? (
          <span className="flex flex-wrap items-center gap-2">
            <Chip tone="warning" icon={<Warning size={12} aria-hidden />}>Conflict: suggests {f.conflict.suggested}</Chip>
            <span className="break-words">{f.conflict.reason}. Your value is still used.</span>
          </span>
        ) : (
          f.note || "—"
        )}
      </td>
    </tr>
  );
}

function RankLine({ r, note, checked, disabled, onToggle }: { r: RankRow; note?: Note; checked: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <li>
      <details className="group">
        <summary className="flex min-h-12 list-none items-center gap-3 px-4 py-2 hover:bg-[var(--plum-4)] [&::-webkit-details-marker]:hidden">
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 accent-[var(--color-plum)]"
            checked={checked}
            disabled={disabled}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Compare ${r.name}`}
          />
          <span className="w-7 shrink-0 font-mono text-xs text-steel-ink tabular-nums">#{r.rank}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
          <span className="hidden sm:block"><Chip>{r.family}</Chip></span>
          <span className="hidden h-2 w-32 shrink-0 overflow-hidden rounded bg-[var(--plum-7)] md:block" aria-hidden>
            <span className="block h-full rounded bg-plum" style={{ width: `${Math.max(0, Math.min(100, r.score))}%` }} />
          </span>
          <span className="w-12 shrink-0 text-right font-mono tabular-nums">{r.score.toFixed(1)}</span>
        </summary>
        <div className="border-t border-[var(--line)] bg-[var(--plum-4)] px-4 py-3 pl-14">
          {note ? <NoteBlock note={note} compact /> : <p className="text-steel-ink">No note.</p>}
        </div>
      </details>
    </li>
  );
}

function Compare({ a, b, labels, onClear }: { a: RankRow; b: RankRow; labels: Record<string, string>; onClear: () => void }) {
  const keys = Object.keys(a.fits);
  return (
    <div className="mb-4"><div className="panel rise overflow-x-auto" role="region" aria-label={`Compare ${a.name} and ${b.name}`}>
      <table className="w-full min-w-[480px] text-left">
        <caption className="sr-only">Per-factor fit of {a.name} and {b.name}</caption>
        <thead className="border-b border-[var(--line)]">
          <tr>
            <th scope="col" className="px-4 py-2 text-xs font-medium text-steel-ink">Factor fit (0 to 1)</th>
            <th scope="col" className="px-4 py-2">{a.name}</th>
            <th scope="col" className="px-4 py-2">{b.name}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)]">
          {keys.map((k) => {
            const x = a.fits[k], y = b.fits[k];
            return (
              <tr key={k}>
                <th scope="row" className="px-4 py-2 font-normal">{labels[k] ?? k}</th>
                <FitCell v={x} best={x > y} />
                <FitCell v={y} best={y > x} />
              </tr>
            );
          })}
          <tr className="font-semibold">
            <th scope="row" className="px-4 py-2">Score</th>
            <td className="px-4 py-2 font-mono tabular-nums">{a.score.toFixed(1)}</td>
            <td className="px-4 py-2 font-mono tabular-nums">{b.score.toFixed(1)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <button type="button" className="btn btn-ghost mt-2 min-h-10 text-sm" onClick={onClear}>Clear comparison</button>
    </div>
  );
}

function FitCell({ v, best }: { v: number; best: boolean }) {
  return (
    <td className="px-4 py-2">
      <span className="flex items-center gap-2">
        <span className={`w-10 font-mono tabular-nums ${best ? "font-semibold" : "text-steel-ink"}`}>{v.toFixed(2)}</span>
        <span className="h-1.5 w-24 overflow-hidden rounded bg-[var(--plum-7)]" aria-hidden>
          <span className={`block h-full rounded ${best ? "bg-plum" : "bg-steel"}`} style={{ width: `${v * 100}%` }} />
        </span>
        {best && <span className="text-xs text-plum">higher</span>}
      </span>
    </td>
  );
}
