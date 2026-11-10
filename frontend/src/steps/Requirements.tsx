import {
  ArrowLeft, ArrowRight, Check, CheckCircle, Circle, PencilSimple, Warning, WarningCircle, X, XCircle,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { patchRequirement, runSdlc, type ReqPatch } from "../api";
import { Chip, type Tone } from "../components/Chip";
import { DraftCta } from "../components/DraftCta";
import { Info } from "../components/Info";
import { StageTracker } from "../components/StageTracker";
import { useToast } from "../components/Toast";
import { localHint, useLlmStatus } from "../hooks/useLlmStatus";
import { useMeta } from "../hooks/useMeta";
import { pct } from "../lib";
import { useTour } from "../tour";
import type { Category, Flag, Priority, ReqStatus, Requirement } from "../types";
import type { StepProps } from "./props";

const STATUS: Record<ReqStatus, { label: string; tone: Tone; icon: ReactNode }> = {
  proposed: { label: "Proposed", tone: "neutral", icon: <Circle size={14} aria-hidden /> },
  accepted: { label: "Accepted", tone: "success", icon: <CheckCircle size={14} aria-hidden /> },
  edited: { label: "Edited", tone: "success", icon: <PencilSimple size={14} aria-hidden /> },
  rejected: { label: "Rejected", tone: "error", icon: <XCircle size={14} aria-hidden /> },
};
const BAND: Record<Requirement["confidence_band"], Tone> = { High: "success", Medium: "warning", Low: "error" };
const SEVERITY: Record<Flag["severity"], { tone: Tone; icon: ReactNode; word: string }> = {
  high: { tone: "error", icon: <WarningCircle size={14} aria-hidden />, word: "High" },
  medium: { tone: "warning", icon: <Warning size={14} aria-hidden />, word: "Medium" },
  low: { tone: "neutral", icon: <Circle size={14} aria-hidden />, word: "Low" },
};
const PRIORITIES: Priority[] = ["Must", "Should", "Could", "Won't"];

export default function Requirements({ project, run, busy, onNext }: StepProps & { onNext?: () => void }) {
  const reqs = project.requirements;
  const { meta } = useMeta();
  const hint = localHint(useLlmStatus());
  const toast = useToast();
  const [selected, setSelected] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false); // narrow screens: list, then detail
  const [editing, setEditing] = useState(false);
  const [running, setRunning] = useState(false); // true only while the SDLC call is in flight
  useTour("requirements", reqs.length > 0);
  const advance = useRef<number | null>(null);
  const rows = useRef<Record<number, HTMLButtonElement | null>>({});

  const counts = useMemo(() => {
    const c: Record<ReqStatus, number> = { proposed: 0, accepted: 0, edited: 0, rejected: 0 };
    reqs.forEach((r) => c[r.status]++);
    return c;
  }, [reqs]);

  // Select the first proposed item on arrival; after an action move on to the next proposed one.
  useEffect(() => {
    if (reqs.length === 0) return;
    if (advance.current !== null) {
      const from = reqs.findIndex((r) => r.seq === advance.current);
      const order = [...reqs.slice(from + 1), ...reqs.slice(0, from + 1)];
      const next = order.find((r) => r.status === "proposed");
      const target = next?.seq ?? advance.current;
      advance.current = null;
      setSelected(target);
      setEditing(false);
      if (next) setTimeout(() => rows.current[target]?.focus(), 0);
    } else if (selected === null || !reqs.some((r) => r.seq === selected)) {
      setSelected((reqs.find((r) => r.status === "proposed") ?? reqs[0]).seq);
    }
  }, [reqs, selected]);

  if (reqs.length === 0) {
    return project.status === "drafting" ? (
      <DraftCta project={project} run={run} busy={busy} />
    ) : (
      <p className="text-steel-ink">No requirements.</p>
    );
  }

  const current = reqs.find((r) => r.seq === selected) ?? reqs[0];
  const approved = counts.accepted + counts.edited;
  const canRun = project.status === "review" && approved > 0 && !busy;
  const stale = !!project.sdlc?.stale;

  const act = (r: Requirement, body: ReqPatch) => {
    advance.current = r.seq; // set before the call so the effect sees it when the new view arrives
    void run(() => patchRequirement(project.id, r.seq, body)).then((ok) => {
      if (!ok) advance.current = null;
    });
  };
  const analyse = () => {
    setRunning(true);
    void run(() => runSdlc(project.id))
      .then((ok) => ok && toast("SDLC analysis complete"))
      .finally(() => setRunning(false));
  };

  return (
    <section aria-labelledby="req-h">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="req-h">Requirements</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-steel-ink">
            <Chip icon={STATUS.proposed.icon}>{counts.proposed} proposed</Chip>
            <Chip tone="success" icon={STATUS.accepted.icon}>{counts.accepted} accepted</Chip>
            <Chip tone="success" icon={STATUS.edited.icon}>{counts.edited} edited</Chip>
            <Chip tone="error" icon={STATUS.rejected.icon}>{counts.rejected} rejected</Chip>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {project.status === "done" && !stale ? (
            <button className="btn btn-primary" onClick={onNext}>
              View SDLC result <ArrowRight size={16} aria-hidden />
            </button>
          ) : (
            <button className="btn btn-primary" disabled={!canRun} onClick={analyse} data-tour="req-run">
              {stale ? "Re-run SDLC analysis" : "Run SDLC analysis"} <ArrowRight size={16} aria-hidden />
            </button>
          )}
          {project.status !== "done" && approved === 0 && (
            <p className="text-sm text-steel-ink">Accept or edit at least one requirement to continue.</p>
          )}
        </div>
      </div>

      {stale && (
        <p role="status" className="panel mt-4 flex items-center gap-2 border-warning px-4 py-3 text-warning-ink">
          <Warning size={18} aria-hidden /> Requirements changed after the last SDLC run. That result is stale until you run the analysis again.
        </p>
      )}
      {project.status === "done" && !stale && (
        <p className="mt-3 text-sm text-steel-ink">Changing a requirement now marks the SDLC result stale.</p>
      )}

      {running && (
        <div className="mt-4">
          <StageTracker stages={["Scoring (deterministic)", "SDLC agent explanation"]} hint={hint} />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className={detailOpen ? "hidden lg:block" : ""} data-tour="req-list">
          <p className="eyebrow mb-2 flex items-center gap-1">Drafted requirements <Info id="req_list" /></p>
          <ul className="panel divide-y divide-[var(--line)] overflow-hidden">
            {reqs.map((r) => {
              const on = r.seq === current.seq;
              const st = STATUS[r.status];
              return (
                <li key={r.seq}>
                  <button
                    ref={(el) => { rows.current[r.seq] = el; }}
                    type="button"
                    aria-current={on ? "true" : undefined}
                    onClick={() => { setSelected(r.seq); setEditing(false); setDetailOpen(true); }}
                    className={`relative block w-full px-4 py-3 text-left transition-colors ${on ? "bg-[var(--plum-7)]" : "hover:bg-[var(--plum-4)]"}`}
                  >
                    {on && <span className="absolute top-0 bottom-0 left-0 w-[3px] bg-plum" aria-hidden />}
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-medium">{r.id}</span>
                      <span className="flex items-center gap-2">
                        {r.quality_flags.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-warning-ink" aria-label={`${r.quality_flags.length} quality flags`}>
                            <Warning size={12} aria-hidden /> {r.quality_flags.length}
                          </span>
                        )}
                        <Chip tone={st.tone} icon={st.icon}>{st.label}</Chip>
                      </span>
                    </span>
                    <span className="mt-1 line-clamp-2 text-sm break-words">{r.statement}</span>
                    <span className="mt-1 block text-xs text-steel-ink">{r.priority}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className={`min-w-0 ${detailOpen ? "" : "hidden lg:block"}`}>
          <button type="button" className="btn btn-ghost mb-3 lg:hidden" onClick={() => setDetailOpen(false)}>
            <ArrowLeft size={16} aria-hidden /> All requirements
          </button>
          {editing && meta ? (
            <EditForm key={current.seq} r={current} categories={meta.categories} busy={busy} onCancel={() => setEditing(false)} onSave={(b) => act(current, b)} />
          ) : (
            <Detail key={current.seq} r={current} busy={busy} onAccept={() => act(current, { action: "accept" })} onReject={() => act(current, { action: "reject" })} onEdit={() => setEditing(true)} />
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- detail pane ---------- */

function Detail({ r, busy, onAccept, onReject, onEdit }: { r: Requirement; busy: boolean; onAccept: () => void; onReject: () => void; onEdit: () => void }) {
  const st = STATUS[r.status];
  return (
    <article className="panel rise p-5 md:p-6" aria-label={r.id}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono font-semibold">{r.id}</span>
        <Chip tone={st.tone} icon={st.icon}>{st.label}</Chip>
        <Chip>{r.priority}</Chip>
        <span className="ml-auto flex items-center gap-1" data-tour="req-confidence">
          <Chip tone={BAND[r.confidence_band]} mono>{r.confidence_band} · {pct(r.confidence)}</Chip>
          <Info id="req_confidence" />
        </span>
      </div>

      <p className="mt-4 text-base leading-relaxed break-words">{r.statement}</p>
      {r.original_statement && (
        <p className="mt-2 text-sm break-words text-steel-ink">
          <span className="font-medium">Original:</span> {r.original_statement}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {r.categories.map((c) => <Chip key={c}>{c}</Chip>)}
      </div>

      <Field title="Acceptance criteria">
        <p className="break-words">{r.acceptance_criteria || <span className="text-steel-ink">None provided.</span>}</p>
      </Field>

      <Field title="Source quote">
        <blockquote className="border-l-2 border-steel pl-3 break-words text-steel-ink italic">
          {r.source_quote ? `“${r.source_quote}”` : "No source quote."}
        </blockquote>
      </Field>

      <Field title="Citations" info="req_citations">
        {r.citations.length === 0 ? (
          <p className="text-steel-ink">No KB citation.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)] rounded-[6px] border border-[var(--line)]">
            {r.citations.map((c) => (
              <li key={c.card_id} className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-medium">{c.card_id}</span>
                  <span className="text-steel-ink">{c.source}{c.clause ? `, ${c.clause}` : ""}</span>
                  {c.basis === "secondary-summary" && <Chip tone="warning" icon={<Warning size={12} aria-hidden />}>summary, verify</Chip>}
                </div>
                {c.reason && <p className="mt-0.5 text-sm break-words text-steel-ink">{c.reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </Field>

      <Field title="Quality flags" info="req_flags" tour="req-flags">
        {r.quality_flags.length === 0 ? (
          <p className="text-steel-ink">No quality flags.</p>
        ) : (
          <ul className="space-y-2">
            {r.quality_flags.map((f, i) => {
              const s = SEVERITY[f.severity] ?? SEVERITY.low;
              return (
                <li key={`${f.code}-${i}`} className="flex flex-wrap items-start gap-2">
                  <Chip tone={s.tone} icon={s.icon}>{s.word}</Chip>
                  <span className="font-mono text-xs text-steel-ink">{f.code}</span>
                  <span className="min-w-0 flex-1 break-words">{f.message}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Field>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-5" data-tour="req-actions">
        <button className="btn btn-primary" disabled={busy || r.status === "accepted"} onClick={onAccept}>
          <Check size={16} aria-hidden /> Accept
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={onEdit}>
          <PencilSimple size={16} aria-hidden /> Edit
        </button>
        <button className="btn btn-ghost" disabled={busy || r.status === "rejected"} onClick={onReject}>
          <X size={16} aria-hidden /> Reject
        </button>
        <Info id="req_actions" />
      </div>
    </article>
  );
}

function Field({ title, info, tour, children }: { title: string; info?: string; tour?: string; children: ReactNode }) {
  return (
    <div className="mt-5" data-tour={tour}>
      <h3 className="eyebrow mb-1.5 flex items-center gap-1">{title} {info && <Info id={info} />}</h3>
      {children}
    </div>
  );
}

/* ---------- inline edit ---------- */

function EditForm({ r, categories, busy, onCancel, onSave }: { r: Requirement; categories: Category[]; busy: boolean; onCancel: () => void; onSave: (b: ReqPatch) => void }) {
  const [statement, setStatement] = useState(r.statement);
  const [priority, setPriority] = useState<Priority>(r.priority);
  const [criteria, setCriteria] = useState(r.acceptance_criteria);
  const [cats, setCats] = useState<Category[]>(r.categories);
  const [tried, setTried] = useState(false);

  const stmtErr = statement.trim().length < 10 ? "At least 10 characters." : statement.trim().length > 600 ? "At most 600 characters." : "";
  const critErr = criteria.length > 600 ? "At most 600 characters." : "";
  const catErr = cats.length === 0 ? "Pick at least one category." : "";
  const sameCats = cats.length === r.categories.length && cats.every((c) => r.categories.includes(c));

  const save = () => {
    setTried(true);
    if (stmtErr || critErr || catErr) return;
    const body: ReqPatch = { action: "edit" };
    if (statement.trim() !== r.statement) body.statement = statement.trim();
    if (priority !== r.priority) body.priority = priority;
    if (criteria.trim() !== r.acceptance_criteria) body.acceptance_criteria = criteria.trim();
    if (!sameCats) body.categories = cats;
    if (Object.keys(body).length === 1) return onCancel(); // nothing changed: the API would reject an empty edit
    onSave(body);
  };

  return (
    <form className="panel rise p-5 md:p-6" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate aria-label={`Edit ${r.id}`}>
      <h2 className="flex items-center gap-2"><span className="font-mono">{r.id}</span> Edit</h2>
      <p className="mt-1 text-sm text-steel-ink">The original text stays on record.</p>

      <label htmlFor="e-stmt" className="mt-4 block font-medium">Statement</label>
      <textarea id="e-stmt" rows={4} className="field mt-1.5 resize-y" value={statement} onChange={(e) => setStatement(e.target.value)} aria-invalid={tried && !!stmtErr} />
      <p className="mt-1 flex justify-between text-sm"><span className="text-error-ink">{tried ? stmtErr : ""}</span><span className="font-mono text-steel-ink">{statement.trim().length} / 600</span></p>

      <label htmlFor="e-pri" className="mt-3 block font-medium">Priority (MoSCoW)</label>
      <select id="e-pri" className="field mt-1.5 w-auto" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
        {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
      </select>

      <label htmlFor="e-crit" className="mt-4 block font-medium">Acceptance criteria</label>
      <textarea id="e-crit" rows={3} className="field mt-1.5 resize-y" value={criteria} onChange={(e) => setCriteria(e.target.value)} aria-invalid={tried && !!critErr} />
      <p className="mt-1 text-sm text-error-ink">{tried ? critErr : ""}</p>

      <fieldset className="mt-3">
        <legend className="font-medium">Categories</legend>
        <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {categories.map((c) => (
            <label key={c} className="flex min-h-10 items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-[var(--color-plum)]" checked={cats.includes(c)} onChange={() => setCats((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))} />
              {c}
            </label>
          ))}
        </div>
        <p className="mt-1 text-sm text-error-ink">{tried ? catErr : ""}</p>
      </fieldset>

      <div className="mt-5 flex gap-3">
        <button type="submit" className="btn btn-primary" disabled={busy}>Save edit</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}
