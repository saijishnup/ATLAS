import { useEffect, useRef } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Empty } from "../components/Empty";
import { ErrorBanner } from "../components/ErrorBanner";
import { Skeleton } from "../components/Skeleton";
import { HelpMenu } from "../components/HelpMenu";
import { Stepper, stepFor, unlocked, type StepNo } from "../components/Stepper";
import { TOUR_STEPS } from "../tour";
import { fetchProjectFile } from "../api";
import { useProject } from "../hooks/useProject";
import { saveCopy } from "../localCopies";
import Clarify from "../steps/Clarify";
import Describe from "../steps/Describe";
import Export from "../steps/Export";
import Requirements from "../steps/Requirements";
import Sdlc from "../steps/Sdlc";

function NewProject() {
  const nav = useNavigate();
  return (
    <AppShell tools={<HelpMenu step="describe" />}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <Stepper project={null} current={1} onGo={() => undefined} />
        <Describe project={null} onCreated={(id) => nav(`/app/p/${id}`, { replace: true })} />
      </div>
    </AppShell>
  );
}

function ProjectView({ id }: { id: string }) {
  const { project, loading, busy, error, run, retry } = useProject(id);
  const [params, setParams] = useSearchParams();
  const prevStatus = useRef(project?.status);

  // After a stage change the server status wins: drop any explicit ?step= so we land on the right screen.
  useEffect(() => {
    if (!project) return;
    if (prevStatus.current && prevStatus.current !== project.status) setParams({}, { replace: true });
    prevStatus.current = project.status;
  }, [project, setParams]);

  // Browser copy (restore after a server reset). Debounced: one fetch after a burst of edits.
  useEffect(() => {
    if (!project) return;
    let off = false;
    const t = setTimeout(() => {
      fetchProjectFile(project.id)
        .then((file) => !off && saveCopy({ id: project.id, name: project.name, status: project.status, savedAt: new Date().toISOString(), file }))
        .catch(() => undefined);
    }, 800);
    return () => {
      off = true;
      clearTimeout(t);
    };
  }, [project]);

  const open = unlocked(project);
  const requested = Number(params.get("step")) as StepNo;
  const valid = requested >= 1 && requested <= 5 && open[requested];
  const current: StepNo = valid ? requested : project ? stepFor(project.status) : 1;

  useEffect(() => {
    if (project && params.get("step") && !valid) setParams({}, { replace: true }); // locked deep link (Review Focus 4)
  }, [project, params, valid, setParams]);

  const go = (n: StepNo) => setParams({ step: String(n) });

  if (!project && error?.status === 404) {
    return (
      <AppShell tools={<HelpMenu />}>
        <Empty title="Project not found" body="It may have been deleted, or the link is wrong. Hosted demos can reset saved projects when they restart." action={<Link to="/app" className="btn btn-primary">Back to projects</Link>} />
      </AppShell>
    );
  }

  return (
    <AppShell tools={<HelpMenu step={TOUR_STEPS[current - 1]} />}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <Stepper project={project} current={current} onGo={go} />
        <div className="min-w-0">
          {loading && <Skeleton rows={4} label="Loading project" />}
          {error && (
            <div className="mb-4">
              <ErrorBanner error={error} onRetry={retry} />
            </div>
          )}
          {project && (
            <div key={current} className="rise">
              {current === 1 && <Describe project={project} onCreated={() => undefined} run={run} busy={busy} />}
              {current === 2 && <Clarify project={project} run={run} busy={busy} />}
              {current === 3 && <Requirements project={project} run={run} busy={busy} onNext={() => go(4)} />}
              {current === 4 && project.sdlc && <Sdlc project={project} run={run} busy={busy} onNext={() => go(5)} onGoRequirements={() => go(3)} />}
              {current === 5 && <Export project={project} run={run} busy={busy} />}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default function Workspace() {
  const { id = "" } = useParams();
  return id === "new" ? <NewProject /> : <ProjectView id={id} />;
}
