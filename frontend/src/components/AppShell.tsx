import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useLlmStatus } from "../hooks/useLlmStatus";
import { Chip } from "./Chip";
import { Gauge, WarningCircle } from "@phosphor-icons/react";

function LlmBadge() {
  const s = useLlmStatus();
  if (!s) return null;
  if (s === "down") return <Chip tone="error" icon={<WarningCircle size={14} aria-hidden />}>Server unreachable</Chip>;
  if (!s.configured) return <Chip tone="warning" icon={<WarningCircle size={14} aria-hidden />}>LLM not configured</Chip>;
  return (
    <Chip mono icon={<Gauge size={14} aria-hidden />}>
      {s.provider} · {s.model} · {s.mode}
    </Chip>
  );
}

export function AppShell({ children, tools }: { children: ReactNode; tools?: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="border-b border-[var(--line)] bg-surface print:hidden">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-6">
          <Link to="/app" className="flex items-baseline gap-3" aria-label="ATLAS, project list">
            <span className="text-xl font-semibold tracking-[0.12em] text-plum">ATLAS</span>
            <span className="hidden text-xs text-steel-ink md:inline">Automotive Technical Lifecycle Analysis System</span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <LlmBadge />
            {tools}
          </div>
        </div>
      </header>
      {import.meta.env.VITE_HOSTED === "1" && (
        <p className="border-b border-[var(--line)] bg-[var(--plum-4)] px-4 py-2 text-center text-xs text-steel-ink print:hidden">
          Demo server. Saved projects can reset when it restarts. Download your project file from the Export step, then reopen it from the project list.
        </p>
      )}
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-8 md:px-6">{children}</main>
      <footer className="border-t border-[var(--line)] px-4 py-3 text-center text-xs text-steel-ink print:hidden">
        Drafts for human review, not compliance advice. Use no real vehicle, customer or personal data.
      </footer>
    </div>
  );
}
