import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "#lib/utils"

// Build a compact page list with ellipses, e.g. [1, "…", 4, 5, 6, "…", 12].
function buildPages(current: number, total: number): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages: (number | "…")[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push("…")
  for (let p = start; p <= end; p++) pages.push(p)
  if (end < total - 1) pages.push("…")
  pages.push(total)
  return pages
}

export function Pagination({
  page,
  totalPages,
  onChange,
  className,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
  className?: string
}) {
  if (totalPages <= 1) return null

  const pages = buildPages(page, totalPages)
  const go = (p: number) => onChange(Math.min(Math.max(1, p), totalPages))

  const arrow =
    "grid size-7 place-items-center rounded-sm border border-white/8 text-muted-foreground transition-colors hover:border-amber-400/60 hover:bg-amber-400/[0.06] hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/8 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"

  return (
    <nav className={cn("flex items-center justify-center gap-1.5", className)} aria-label="Pagination">
      <button onClick={() => go(page - 1)} disabled={page <= 1} title="Previous" className={arrow}>
        <ChevronLeft className="size-3.5" />
      </button>

      {pages.map((p, i) =>
        p === "…" ? (
          <span
            key={`gap-${i}`}
            className="grid size-7 place-items-center font-mono text-[11px] text-muted-foreground/50"
          >
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => go(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "grid size-7 place-items-center rounded-sm border font-mono text-[11px] tabular-nums tracking-wider transition-colors",
              p === page
                ? "border-amber-400/50 bg-amber-400/10 text-amber-200"
                : "border-white/8 text-muted-foreground hover:border-amber-400/40 hover:bg-white/[0.04] hover:text-foreground"
            )}
          >
            {p.toString().padStart(2, "0")}
          </button>
        )
      )}

      <button onClick={() => go(page + 1)} disabled={page >= totalPages} title="Next" className={arrow}>
        <ChevronRight className="size-3.5" />
      </button>
    </nav>
  )
}
