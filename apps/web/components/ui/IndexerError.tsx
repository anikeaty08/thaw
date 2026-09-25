import { Icon } from "./Icon";
import { Button } from "./Button";

export function IndexerError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/25 bg-danger/[0.06] px-5 py-4 text-sm">
      <Icon name="warning" size={18} className="text-danger" />
      <p className="min-w-0 flex-1 text-mist-300">
        Couldn't load {what}. The indexer isn't responding; check that it's running and{" "}
        <code className="rounded bg-glacier-900 px-1 py-0.5 font-mono text-xs">NEXT_PUBLIC_INDEXER_URL</code> points to it.
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function SkeletonRows({ rows = 2, height = 76 }: { rows?: number; height?: number }) {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-glacier-700/60 bg-glacier-800/40" style={{ height }} />
      ))}
    </div>
  );
}
