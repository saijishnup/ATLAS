import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react";
import type { ApiError } from "../api";

/** Error table from spec section 5. Non-retryable errors get no Retry button. */
export function ErrorBanner({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  if (error.code === "llm_not_configured") {
    return (
      <div role="alert" className="panel rise border-warning p-5">
        <div className="flex items-center gap-2 text-warning-ink">
          <WarningCircle size={20} aria-hidden />
          <h3>Language model not configured</h3>
        </div>
        <p className="mt-2 max-w-[65ch] text-steel-ink">
          Clarification and drafting need an LLM. Set these in the backend <code className="font-mono">.env</code> file, then
          restart the server:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-[6px] bg-[var(--plum-4)] p-3 font-mono text-xs">
{`LLM_BASE_URL=...
LLM_API_KEY=...
LLM_MODEL=...`}
        </pre>
        <p className="mt-3 text-steel-ink">SDLC scoring still works without a model, using rule-based text.</p>
      </div>
    );
  }
  const hint =
    error.code === "rate_limited" ? "Wait a few seconds, then retry."
    : error.code === "daily_cap" ? "The daily model call limit is used up."
    : error.code === "wrong_stage" ? "The project moved on. Showing the latest state."
    : "";
  return (
    <div role="alert" className="panel rise flex flex-wrap items-start gap-3 border-error p-4">
      <WarningCircle size={20} className="mt-0.5 shrink-0 text-error-ink" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-error-ink">{error.message}</p>
        {hint && <p className="mt-0.5 text-steel-ink">{hint}</p>}
      </div>
      {error.retryable && onRetry && (
        <button className="btn btn-ghost" onClick={onRetry}>
          <ArrowClockwise size={16} aria-hidden /> Retry
        </button>
      )}
    </div>
  );
}
