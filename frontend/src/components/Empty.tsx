import type { ReactNode } from "react";

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="panel rise p-8" role="status">
      <h2>{title}</h2>
      <p className="mt-2 max-w-[60ch] text-steel-ink">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
