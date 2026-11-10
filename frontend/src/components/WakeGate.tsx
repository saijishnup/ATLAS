import type { ReactNode } from "react";
import { useBackendReady } from "../hooks/useBackendReady";
import { Skeleton } from "./Skeleton";

/** Holds the app back until the backend answers. Free hosts sleep when idle and need about a minute to wake. */
export function WakeGate({ children }: { children: ReactNode }) {
  const { ready, slow, seconds } = useBackendReady();
  if (ready) return <>{children}</>;
  if (!slow) return null;
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="border-b border-[var(--line)] bg-surface">
        <div className="mx-auto max-w-[1100px] px-4 py-3 md:px-6">
          <span className="text-xl font-semibold tracking-[0.12em] text-plum">ATLAS</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-8 md:px-6">
        <h1>Waking the server</h1>
        <p className="mt-1 max-w-[60ch] text-steel-ink">
          ATLAS runs on a free host that sleeps when idle. Waking takes about a minute. This page opens by itself.
        </p>
        <div className="panel mt-6 p-4">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <span className="font-medium">Waiting for the server</span>
            <span className="font-mono text-sm text-steel-ink" aria-hidden>{seconds} s</span>
          </div>
          <Skeleton rows={3} label="Waiting for the server" />
        </div>
        {seconds >= 90 && <p className="mt-4 text-steel-ink">Still waiting. Retrying every few seconds.</p>}
        <p className="mt-6 text-xs text-steel-ink">
          Running locally? Start the backend with <code className="font-mono">uvicorn backend.main:app</code>.
        </p>
      </main>
    </div>
  );
}
