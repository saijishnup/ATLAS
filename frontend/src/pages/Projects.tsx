import { ArrowCounterClockwise, ArrowRight, CheckCircle, Plus, Trash, UploadSimple, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, deleteProject, getSamples, importProject, listProjects } from "../api";
import { AppShell } from "../components/AppShell";
import { Chip } from "../components/Chip";
import { Empty } from "../components/Empty";
import { ErrorBanner } from "../components/ErrorBanner";
import { HelpMenu } from "../components/HelpMenu";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { dropCopy, listCopies } from "../localCopies";
import { fmtDate, statusLabel, typeLabel } from "../lib";
import type { ProjectRow, Sample } from "../types";

export default function Projects() {
  const [rows, setRows] = useState<ProjectRow[] | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);
  const [copies, setCopies] = useState(listCopies);
  const [importError, setImportError] = useState<ApiError | null>(null);
  const [importing, setImporting] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  const toast = useToast();

  async function importText(text: string, forget?: string) {
    setImportError(null);
    setImporting(true);
    try {
      const v = await importProject(text);
      if (forget) dropCopy(forget);
      v.import_notes?.forEach((n) => toast(n));
      toast(`Opened ${v.name}`);
      nav(`/app/p/${v.id}`);
    } catch (e) {
      setImportError(e as ApiError);
    } finally {
      setImporting(false);
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // same file can be chosen again
    if (!f) return;
    if (f.size > 1_000_000) return setImportError(new ApiError(413, "file_too_large", "Project file is over 1 MB.", false));
    await importText(await f.text());
  }

  async function remove(r: ProjectRow) {
    setDeleting(true);
    try {
      await deleteProject(r.id);
      dropCopy(r.id); // else "Saved in this browser" would offer it back
      setCopies(listCopies());
      setRows((rs) => rs && rs.filter((x) => x.id !== r.id));
      toast(`Deleted ${r.name}`);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setConfirmId(null);
      setDeleting(false);
    }
  }

  // Browser copies whose project the server no longer has (hosted servers reset)
  const missing = rows ? copies.filter((c) => !rows.some((r) => r.id === c.id)) : [];

  useEffect(() => {
    setError(null);
    listProjects().then(setRows).catch((e) => setError(e as ApiError));
    getSamples().then(setSamples).catch(() => undefined); // samples are optional here
  }, [nonce]);

  const newBtn = (
    <Link to="/app/p/new" className="btn btn-primary">
      <Plus size={16} aria-hidden /> New project
    </Link>
  );

  return (
    <AppShell tools={<HelpMenu />}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Projects</h1>
          <p className="mt-1 max-w-[60ch] text-steel-ink">
            Describe an automotive software project. ATLAS drafts cited requirements, then recommends an SDLC model.
            Have a project file? Open it to continue where you stopped.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={importing}>
            <UploadSimple size={16} aria-hidden /> Open project file
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-label="Project file" onChange={onFile} />
          {rows && rows.length > 0 && newBtn}
        </div>
      </div>

      {importError && (
        <div className="mt-4">
          <ErrorBanner error={importError} />
        </div>
      )}

      {missing.length > 0 && (
        <section className="mt-8" aria-labelledby="copies-h">
          <h2 id="copies-h">Saved in this browser</h2>
          <p className="mt-1 max-w-[60ch] text-steel-ink">The server no longer has these projects. Restore brings one back from the copy kept in this browser.</p>
          <ul className="panel mt-4 divide-y divide-[var(--line)]">
            {missing.map((c) => (
              <li key={c.id} className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[minmax(0,2fr)_110px_170px_auto]">
                <span className="truncate font-medium">{c.name}</span>
                <span className="hidden md:block"><Chip>{statusLabel[c.status]}</Chip></span>
                <span className="hidden font-mono text-xs text-steel-ink md:block">{fmtDate(c.savedAt)}</span>
                <span className="col-span-2 flex justify-end gap-2 md:col-span-1">
                  <button className="btn btn-ghost" disabled={importing} onClick={() => void importText(c.file, c.id)}>
                    <ArrowCounterClockwise size={16} aria-hidden /> Restore
                  </button>
                  <button className="btn btn-ghost" aria-label={`Forget the browser copy of ${c.name}`} onClick={() => { dropCopy(c.id); setCopies(listCopies()); }}>
                    <X size={16} aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8" aria-labelledby="list-h">
        <h2 id="list-h" className="sr-only">Your projects</h2>
        {error ? (
          <ErrorBanner error={error} onRetry={() => setNonce((n) => n + 1)} />
        ) : !rows ? (
          <Skeleton rows={3} label="Loading projects" />
        ) : rows.length === 0 ? (
          <Empty title="No projects yet" body="Start with your own description, or load one of the samples below." action={newBtn} />
        ) : (
          <ul className="panel divide-y divide-[var(--line)]">
            {rows.map((r) => (
              <li key={r.id} className="relative flex items-center">
                <Link to={`/app/p/${r.id}`} className="grid min-h-14 min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-[var(--plum-4)] md:grid-cols-[minmax(0,2fr)_150px_110px_170px]">
                  <span className="truncate font-medium">{r.name}</span>
                  <span className="hidden text-steel-ink md:block">{typeLabel[r.project_type]}</span>
                  <span className="justify-self-end">
                    <Chip tone={r.status === "done" ? "success" : "neutral"} icon={r.status === "done" ? <CheckCircle size={14} aria-hidden /> : undefined}>
                      {statusLabel[r.status]}
                    </Chip>
                  </span>
                  <span className="col-span-2 font-mono text-xs text-steel-ink md:col-span-1">{fmtDate(r.updated_at)}</span>
                </Link>
                <span className="flex shrink-0 items-center pr-3">
                  <button className="btn btn-ghost min-h-10" aria-label={`Delete ${r.name}`} onClick={() => setConfirmId(r.id)}>
                    <Trash size={16} aria-hidden />
                  </button>
                </span>
                {confirmId === r.id && (
                  <div role="alertdialog" aria-label={`Delete ${r.name}?`} className="absolute inset-0 flex items-center justify-end gap-2 rounded-[10px] bg-[var(--color-surface)] pr-3">
                    <span className="truncate pr-2 text-sm text-steel-ink">Delete “{r.name}”?</span>
                    <button className="btn btn-danger min-h-10 text-sm" disabled={deleting} onClick={() => void remove(r)} autoFocus>Delete</button>
                    <button className="btn btn-ghost min-h-10 text-sm" disabled={deleting} onClick={() => setConfirmId(null)}>Cancel</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {samples.length > 0 && (
        <section className="mt-12" aria-labelledby="sample-h">
          <h2 id="sample-h">Start from a sample</h2>
          <p className="mt-1 text-steel-ink">Fills the form. You can edit everything before saving.</p>
          <ul className="panel mt-4 divide-y divide-[var(--line)]">
            {samples.map((s) => (
              <li key={s.id}>
                <Link to={`/app/p/new?sample=${s.id}`} className="group grid items-baseline gap-x-6 gap-y-1 px-4 py-3 hover:bg-[var(--plum-4)] md:grid-cols-[220px_1fr_auto]">
                  <span>
                    <span className="eyebrow block">{typeLabel[s.project_type]}</span>
                    <span className="font-medium">{s.name}</span>
                  </span>
                  <span className="line-clamp-2 text-steel-ink">{s.description}</span>
                  <span className="inline-flex items-center gap-1 text-plum">
                    Use sample <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}
