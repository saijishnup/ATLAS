import { fmtDate, pct, statusLabel, typeLabel } from "../lib";
import type { Project } from "../types";

/** Print-only report: "Save as PDF" prints this and hides the app chrome (print:hidden elsewhere). */
export function PrintReport({ project: p }: { project: Project }) {
  const kept = p.requirements.filter((r) => r.status !== "rejected");
  const rejected = p.requirements.filter((r) => r.status === "rejected");
  const s = p.sdlc;
  return (
    <article className="hidden text-[11px] leading-snug print:block">
      <h1 className="text-2xl">{p.name}</h1>
      <p className="mt-1">
        {typeLabel[p.project_type]} · {statusLabel[p.status]} · provider {p.llm_provider ?? "unknown"} · knowledge base {p.kb_version ?? "unknown"} · printed {fmtDate(new Date().toISOString())}
      </p>
      <p className="mt-1 italic">
        Drafts for human review, not compliance advice. The SDLC fit matrix is expert judgement, not an empirical benchmark. Cards marked summary are own-words summaries: verify against the standard.
      </p>
      <p className="mt-3">{p.description}</p>

      <h2 className="mt-5 text-base">Requirements ({kept.length})</h2>
      <table className="mt-2 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-black">
            <th className="py-1 pr-2">ID</th><th className="pr-2">Requirement and acceptance criteria</th><th className="pr-2">Priority</th>
            <th className="pr-2">Citations</th><th className="pr-2">Confidence</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {kept.map((r) => (
            <tr key={r.seq} className="break-inside-avoid border-b border-neutral-400 align-top">
              <td className="py-1 pr-2 font-mono">{r.id}</td>
              <td className="pr-2">
                {r.statement}
                <div className="mt-0.5">Accept when: {r.acceptance_criteria}</div>
                <div className="mt-0.5">{r.categories.join(", ")}</div>
                {r.quality_flags.length > 0 && <div className="mt-0.5">Flags: {r.quality_flags.map((f) => f.code).join(", ")}</div>}
              </td>
              <td className="pr-2">{r.priority}</td>
              <td className="pr-2">{r.citations.length ? r.citations.map((c) => `${c.source} ${c.clause}`.trim()).join("; ") : "none"}</td>
              <td className="pr-2">{r.confidence_band} ({pct(r.confidence)})</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rejected.length > 0 && (
        <>
          <h2 className="mt-5 text-base">Rejected ({rejected.length})</h2>
          <ul className="mt-1 list-disc pl-5">
            {rejected.map((r) => <li key={r.seq}><span className="font-mono">{r.id}</span> {r.statement}</li>)}
          </ul>
        </>
      )}

      {s && (
        <section className="mt-5 break-before-page">
          <h2 className="text-base">SDLC recommendation</h2>
          {s.stale && <p className="mt-1 font-medium">This result is stale: requirements changed after it was computed.</p>}
          <p className="mt-1">{s.rationale.summary}</p>
          {s.confidence && <p className="mt-1">Ranking confidence: {s.confidence.text}</p>}
          <table className="mt-2 w-full border-collapse text-left">
            <thead><tr className="border-b border-black"><th className="py-1 pr-2">Rank</th><th className="pr-2">Model</th><th>Score</th></tr></thead>
            <tbody>
              {s.ranking.slice(0, 5).map((m) => (
                <tr key={m.model} className="border-b border-neutral-400"><td className="py-1 pr-2">{m.rank}</td><td className="pr-2">{m.name}</td><td>{m.score}</td></tr>
              ))}
            </tbody>
          </table>
          {s.rationale.top.map((n) => <p key={n.model} className="mt-2"><strong>{n.name}.</strong> {n.text}</p>)}
          <h3 className="mt-4 text-sm">Factors</h3>
          <table className="mt-1 w-full border-collapse text-left">
            <tbody>
              {s.factors.map((f) => (
                <tr key={f.factor} className="border-b border-neutral-400"><td className="py-0.5 pr-2">{f.label}</td><td className="pr-2">{f.level}</td><td>{f.tag}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </article>
  );
}
