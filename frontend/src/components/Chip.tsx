import type { CSSProperties, ReactNode } from "react";

export type Tone = "neutral" | "error" | "success" | "warning";

const tones: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: "var(--plum-7)", fg: "var(--color-steel-ink)" },
  error: { bg: "color-mix(in srgb, var(--color-error) 12%, white)", fg: "var(--color-error-ink)" },
  success: { bg: "color-mix(in srgb, var(--color-success) 12%, white)", fg: "var(--color-success-ink)" },
  warning: { bg: "color-mix(in srgb, var(--color-warning) 12%, white)", fg: "var(--color-warning-ink)" },
};

/** Status chip: tinted background, dark text, optional icon. Colour is never the only signal. */
export function Chip({ tone = "neutral", icon, children, mono }: { tone?: Tone; icon?: ReactNode; children: ReactNode; mono?: boolean }) {
  const t = tones[tone];
  const style: CSSProperties = { background: t.bg, color: t.fg };
  return (
    <span
      style={style}
      className={`inline-flex items-center gap-1 rounded-[6px] px-2 py-0.5 text-xs font-medium whitespace-nowrap ${mono ? "font-mono" : ""}`}
    >
      {icon}
      {children}
    </span>
  );
}
