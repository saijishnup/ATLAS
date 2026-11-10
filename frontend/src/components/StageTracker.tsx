import { useEffect, useState } from "react";

/** Honest tracker: no percent, only the stages the server runs and a real elapsed counter. */
export function StageTracker({ stages, hint }: { stages: string[]; hint?: string }) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="panel rise p-5" role="status" aria-live="polite" aria-busy="true">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-medium">Working: {stages.join(" → ")}</p>
        <span className="font-mono text-steel-ink tabular-nums">{sec}s</span>
      </div>
      {hint && <p className="mt-1 text-steel-ink">{hint}</p>}
      <div className="mt-4 space-y-2" aria-hidden>
        <div className="skel h-4 w-3/4" />
        <div className="skel h-4 w-1/2" />
        <div className="skel h-4 w-2/3" />
      </div>
    </div>
  );
}
