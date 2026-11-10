import { DownloadSimple, FilePdf } from "@phosphor-icons/react";
import { useState } from "react";
import { exportUrl } from "../api";
import { Chip } from "../components/Chip";
import { Info } from "../components/Info";
import { PrintReport } from "../components/PrintReport";
import { useToast } from "../components/Toast";
import { useLlmStatus } from "../hooks/useLlmStatus";
import { fmtDate } from "../lib";
import { useTour } from "../tour";
import type { StepProps } from "./props";

const FORMATS = [
  { v: "md", label: "Markdown", hint: "Readable report" },
  { v: "json", label: "Project file", hint: "JSON, reopen in ATLAS" },
] as const;

export default function Export({ project }: StepProps) {
  const [format, setFormat] = useState<"md" | "json">("md");
  const toast = useToast();
  useTour("export");
  const llm = useLlmStatus();
  const count = (s: string) => project.requirements.filter((r) => r.status === s).length;
  const rows: [string, string][] = [
    ["Accepted", String(count("accepted"))],
    ["Edited", String(count("edited"))],
    ["Rejected", String(count("rejected"))],
    ["Provider at creation", project.llm_provider ?? "unknown"],
    ["Model now configured", llm && llm !== "down" ? llm.model : "unknown"],
    ["Knowledge base version", project.kb_version ?? "unknown"],
    ["Last updated", fmtDate(project.updated_at)],
  ];

  return (
    <>
    <section aria-labelledby="exp-h" className="max-w-[760px] print:hidden">
      <h1 id="exp-h">Export</h1>
      <p className="mt-1 max-w-[60ch] text-steel-ink">Download the requirements, citations, flags, SDLC ranking and explanations for {project.name}.</p>

      {project.sdlc?.stale && (
        <p role="status" className="panel mt-4 border-warning px-4 py-3 text-warning-ink">
          The SDLC result is stale. The export will say so. Re-run the analysis first for a current report.
        </p>
      )}

      <dl className="panel mt-6 divide-y divide-[var(--line)]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
            <dt className="text-steel-ink">{k}</dt>
            <dd className="font-mono text-sm">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6" data-tour="export-download">
        <p className="mb-2 flex items-center gap-1 font-medium">Format <Info id="export_download" /></p>
        <div role="radiogroup" aria-label="Export format" className="inline-grid grid-cols-2 overflow-hidden rounded-[6px] border border-[var(--line)]">
          {FORMATS.map((f) => (
            <label key={f.v} className="relative">
              <input type="radio" name="format" value={f.v} checked={format === f.v} onChange={() => setFormat(f.v)} className="peer sr-only" />
              <span className="flex min-h-12 min-w-40 flex-col items-center justify-center border-l border-[var(--line)] px-3 first:border-l-0 hover:bg-[var(--plum-4)] peer-checked:bg-plum peer-checked:text-canvas peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-plum">
                <span className="font-medium">{f.label}</span>
                <span className="text-xs opacity-80">{f.hint}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a className="btn btn-primary" href={exportUrl(project.id, format)} download onClick={() => toast(`Downloading ${format === "md" ? "Markdown report" : "project file"}`)}>
            <DownloadSimple size={16} aria-hidden /> Download
          </a>
          <button className="btn btn-ghost" onClick={() => window.print()}>
            <FilePdf size={16} aria-hidden /> Save as PDF
          </button>
          <Chip>Drafts for human review, not compliance advice</Chip>
        </div>
      </div>
    </section>
    <PrintReport project={project} />
    </>
  );
}
