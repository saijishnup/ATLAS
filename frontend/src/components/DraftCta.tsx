import { draft } from "../api";
import { localHint, useLlmStatus } from "../hooks/useLlmStatus";
import type { StepProps } from "../steps/props";
import { StageTracker } from "./StageTracker";
import { useToast } from "./Toast";

export function DraftCta({ project, run, busy }: StepProps) {
  const hint = localHint(useLlmStatus());
  const toast = useToast();
  if (busy) return <StageTracker stages={["Requirement agent", "citations and quality checks in parallel"]} hint={hint} />;
  return (
    <div className="panel rise p-8">
      <h2>Ready to draft requirements</h2>
      <p className="mt-2 max-w-[60ch] text-steel-ink">
        The requirement agent will draft requirements from your description and answers. Each one is then matched to knowledge cards and checked for quality. You review every item next.
      </p>
      <button className="btn btn-primary mt-5" onClick={() => run(() => draft(project.id)).then((ok) => ok && toast("Requirements drafted. Review each one."))}>
        Draft requirements
      </button>
    </div>
  );
}
