import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError, clarify, createProject, getSamples } from "../api";
import { ErrorBanner } from "../components/ErrorBanner";
import { Info } from "../components/Info";
import { StageTracker } from "../components/StageTracker";
import { Skeleton } from "../components/Skeleton";
import { localHint, useLlmStatus } from "../hooks/useLlmStatus";
import { useMeta } from "../hooks/useMeta";
import { typeLabel } from "../lib";
import { useTour } from "../tour";
import type { Intake, Level, Meta, Project, ProjectType, Sample } from "../types";
import type { StepProps } from "./props";

const LEVELS: { v: Level; label: string }[] = [
  { v: "low", label: "Low" },
  { v: "medium", label: "Medium" },
  { v: "high", label: "High" },
  { v: "not sure", label: "Not sure" },
];

const levelWord = (v: string) => LEVELS.find((l) => l.v === v)?.label ?? v;

interface Props {
  project: Project | null;
  onCreated: (id: string) => void;
  run?: StepProps["run"];
  busy?: boolean;
}

export default function Describe({ project, onCreated, run, busy }: Props) {
  const { meta, error: metaError, retry } = useMeta();
  const llm = useLlmStatus();

  if (metaError) return <ErrorBanner error={metaError} onRetry={retry} />;
  if (!meta) return <Skeleton rows={5} label="Loading form" />;

  return project ? (
    <Summary project={project} meta={meta} run={run!} busy={!!busy} hint={localHint(llm)} />
  ) : (
    <Form meta={meta} onCreated={onCreated} hint={localHint(llm)} />
  );
}

/* ---------- read-only view of an existing project ---------- */

function Summary({ project, meta, run, busy, hint }: { project: Project; meta: Meta; run: StepProps["run"]; busy: boolean; hint?: string }) {
  return (
    <section aria-labelledby="desc-h">
      <h1 id="desc-h">{project.name}</h1>
      <p className="mt-1 text-steel-ink">{typeLabel[project.project_type]}</p>
      <p className="mt-4 max-w-[70ch] whitespace-pre-line">{project.description}</p>

      <h2 className="mt-8">Project traits</h2>
      <dl className="panel mt-3 divide-y divide-[var(--line)]">
        {meta.traits.map((t) => (
          <div key={t.trait} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
            <dt>{t.label}</dt>
            <dd className="font-medium">{levelWord(project.traits[t.trait] ?? "not sure")}</dd>
          </div>
        ))}
      </dl>

      {project.status === "intake" && (
        <div className="mt-6">
          {busy ? (
            <StageTracker stages={["Clarification agent"]} hint={hint} />
          ) : (
            <>
              <p className="mb-3 text-steel-ink">This project has not been clarified yet.</p>
              <button className="btn btn-primary" onClick={() => run(() => clarify(project.id))}>
                Ask clarifying questions
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------- new project form ---------- */

function Form({ meta, onCreated, hint }: { meta: Meta; onCreated: (id: string) => void; hint?: string }) {
  const [params] = useSearchParams();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectType>("other");
  const [description, setDescription] = useState("");
  const [traits, setTraits] = useState<Record<string, Level>>(() => Object.fromEntries(meta.traits.map((t) => [t.trait, "not sure" as Level])));
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null); // reuse on retry: never create twice
  useTour("describe", samples.length > 0); // wait for samples so the sample stop exists

  const load = (s: Sample) => {
    setName(s.name);
    setType(s.project_type);
    setDescription(s.description);
    setTraits({ ...Object.fromEntries(meta.traits.map((t) => [t.trait, "not sure" as Level])), ...s.traits });
    setCreatedId(null);
    setError(null);
  };

  useEffect(() => {
    getSamples()
      .then((list) => {
        setSamples(list);
        const want = params.get("sample");
        const hit = want && list.find((s) => s.id === want);
        if (hit) load(hit);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nameErr = !name.trim() ? "Enter a project name." : name.trim().length > 80 ? "Use 80 characters or fewer." : "";
  const dLen = description.trim().length;
  const descErr = dLen < 40 ? `Add ${40 - dLen} more character${40 - dLen === 1 ? "" : "s"} (minimum 40).` : dLen > 4000 ? "Use 4000 characters or fewer." : "";
  const valid = !nameErr && !descErr;

  const submit = async () => {
    setSubmitted(true);
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const intake: Intake = { name: name.trim(), project_type: type, description: description.trim(), traits };
    try {
      const id = createdId ?? (await createProject(intake)).id;
      setCreatedId(id);
      await clarify(id);
      onCreated(id);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  };

  const typeOptions = useMemo(() => meta.project_types, [meta]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate aria-labelledby="new-h" className="max-w-[760px]">
      <h1 id="new-h">Describe your project</h1>
      <p className="mt-1 text-steel-ink">Short facts first, details in your own words. You can answer follow-up questions next.</p>

      {samples.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3" data-tour="describe-sample">
          <label htmlFor="sample" className="flex items-center gap-1 font-medium">
            Load a sample <Info id="sample" />
          </label>
          <select
            id="sample"
            className="field w-auto min-w-56"
            value=""
            onChange={(e) => {
              const s = samples.find((x) => x.id === e.target.value);
              if (s) load(s);
            }}
          >
            <option value="">Choose…</option>
            {samples.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-6 grid gap-5 md:grid-cols-[1fr_240px]">
        <div>
          <label htmlFor="name" className="flex items-center gap-1 font-medium">
            Project name <Info id="name" />
          </label>
          <input id="name" className="field mt-1.5" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} aria-invalid={submitted && !!nameErr} aria-describedby="name-err" autoComplete="off" />
          <p id="name-err" className="mt-1 min-h-5 text-sm text-error-ink">{submitted ? nameErr : ""}</p>
        </div>
        <div data-tour="describe-type">
          <label htmlFor="type" className="flex items-center gap-1 font-medium">
            Project type <Info id="type" />
          </label>
          <select id="type" className="field mt-1.5" value={type} onChange={(e) => setType(e.target.value as ProjectType)}>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{typeLabel[t]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-1" data-tour="describe-description">
        <label htmlFor="desc" className="flex items-center gap-1 font-medium">
          Description <Info id="description" />
        </label>
        <textarea id="desc" rows={6} className="field mt-1.5 resize-y" value={description} onChange={(e) => setDescription(e.target.value)} aria-invalid={submitted && !!descErr} aria-describedby="desc-err" />
        <div className="mt-1 flex justify-between gap-4 text-sm">
          <p id="desc-err" className="min-h-5 text-error-ink">{submitted ? descErr : ""}</p>
          <p className={`font-mono tabular-nums ${dLen >= 40 ? "text-success-ink" : "text-steel-ink"}`}>{dLen} / 40+</p>
        </div>
      </div>

      <fieldset className="mt-6" data-tour="describe-traits">
        <legend className="flex items-center gap-1 text-lg font-semibold">
          Project traits <Info id="traits" />
        </legend>
        <p className="mt-1 text-steel-ink">These feed the SDLC score. Choose Not sure if unknown.</p>
        <div className="panel mt-3 divide-y divide-[var(--line)]">
          {meta.traits.map((t) => {
            const value = traits[t.trait] ?? "not sure";
            const hintText = value === "not sure" ? "Counts as neutral." : t.levels[value as "low" | "medium" | "high"];
            return (
              <div key={t.trait} className="grid gap-2 px-4 py-3 md:grid-cols-[1fr_auto] md:items-center md:gap-6" role="radiogroup" aria-labelledby={`lab-${t.trait}`}>
                <div>
                  <p id={`lab-${t.trait}`} className="flex items-center gap-1 font-medium">
                    {t.label} <Info id={`trait_${t.trait}`} />
                  </p>
                  <p className="text-sm text-steel-ink">{hintText}</p>
                </div>
                <div className="inline-grid grid-cols-4 overflow-hidden rounded-[6px] border border-[var(--line)]">
                  {LEVELS.map((l) => (
                    <label key={l.v} className="relative">
                      <input type="radio" name={t.trait} value={l.v} checked={value === l.v} onChange={() => setTraits((x) => ({ ...x, [t.trait]: l.v }))} className="peer sr-only" />
                      <span className="flex min-h-10 min-w-16 items-center justify-center border-l border-[var(--line)] px-2 text-sm transition-colors first:border-l-0 hover:bg-[var(--plum-4)] peer-checked:bg-plum peer-checked:text-canvas peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-plum">
                        {l.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 space-y-4">
        {error && <ErrorBanner error={error} onRetry={error.retryable ? () => void submit() : undefined} />}
        {busy ? (
          <StageTracker stages={createdId ? ["Clarification agent"] : ["Saving project", "Clarification agent"]} hint={hint} />
        ) : (
          <button type="submit" className="btn btn-primary" data-tour="describe-submit">
            Save and continue
          </button>
        )}
      </div>
    </form>
  );
}
