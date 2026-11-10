export function Skeleton({ rows = 3, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-3" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skel h-12" style={{ opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}
