/**
 * The attempt screen, before the server has said what is on the paper.
 *
 * This traces the real layout rather than showing a boot animation, so the
 * moment the attempt arrives is a fill-in rather than a re-layout: the same
 * 64px header with the same clusters left and right, the same padded workspace,
 * the same 288px navigator down the right, the same footer bar. Nothing moves
 * when the content lands -- it simply gains its words.
 *
 * The workspace is drawn as one panel rather than as the three-column diagram
 * or programming split, because at this point nothing knows what the first
 * question's type is. Guessing wrong would produce exactly the re-layout the
 * skeleton exists to avoid, and every layout begins with a panel in that
 * position anyway.
 *
 * The navigator grid is five across, which is what the real one is fixed at.
 */

const NAV_CELLS = 30

function Bar({ className = "" }) {
  return <div className={`rounded bg-rb-swan motion-safe:animate-pulse ${className}`} />
}

export default function AttemptSkeleton() {
  return (
    <div
      className="rebyu-ds flex h-dvh flex-col overflow-hidden bg-rb-polar"
      role="status"
      aria-label="Preparing your attempt"
    >
      {/* Header: Exit, title and subtitle, type badge | save state, timer, Finish. */}
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b-2 border-rb-swan bg-rb-snow px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Bar className="h-8 w-16" />
          <div className="min-w-0 space-y-1.5">
            <Bar className="h-4 w-40" />
            <Bar className="h-3 w-28" />
          </div>
          <Bar className="hidden h-6 w-24 rounded-[var(--radius-rb-pill)] sm:block" />
        </div>

        <div className="flex items-center gap-3">
          <Bar className="hidden h-4 w-14 sm:block" />
          <Bar className="h-9 w-24 rounded-[var(--radius-rb-pill)]" />
          <Bar className="h-9 w-32 rounded-[var(--radius-rb-pill)]" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4">
        {/* Workspace. */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden rounded-[var(--radius-rb-card)] border bg-background p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Bar className="h-4 w-24" />
            <Bar className="h-6 w-20 rounded-[var(--radius-rb-pill)]" />
            <Bar className="h-6 w-28 rounded-[var(--radius-rb-pill)]" />
          </div>

          {/* The question. Ragged widths on the last line of each block, because
              a stack of equal-length bars reads as a table, not as prose. */}
          <div className="space-y-2.5">
            <Bar className="h-3.5 w-full" />
            <Bar className="h-3.5 w-full" />
            <Bar className="h-3.5 w-11/12" />
            <Bar className="h-3.5 w-4/5" />
          </div>

          <div className="space-y-2.5 pt-2">
            <Bar className="h-3.5 w-full" />
            <Bar className="h-3.5 w-10/12" />
            <Bar className="h-3.5 w-2/3" />
          </div>

          {/* Answer area. */}
          <div className="mt-auto space-y-3">
            <Bar className="h-3 w-20" />
            <div className="h-28 rounded-[var(--radius-rb-control)] border-2 border-rb-swan" />
          </div>
        </div>

        {/* Navigator: five across, then the legend block beneath it. */}
        <aside className="hidden min-h-0 w-72 shrink-0 flex-col overflow-hidden rounded-[var(--radius-rb-card)] border bg-background p-4 lg:flex">
          <div className="flex items-center justify-between">
            <Bar className="h-3 w-28" />
            <Bar className="h-3 w-12" />
          </div>

          <div className="mt-3 grid min-h-0 flex-1 auto-rows-max grid-cols-5 gap-2 overflow-hidden px-1.5 pt-1.5">
            {Array.from({ length: NAV_CELLS }).map((_, cell) => (
              <div
                key={cell}
                className="h-16 rounded-[var(--radius-rb-control)] border-2 border-rb-swan bg-rb-polar motion-safe:animate-pulse"
              />
            ))}
          </div>

          <div className="mt-3 shrink-0 space-y-2 rounded-[var(--radius-rb-card)] border-2 border-rb-swan bg-rb-polar p-3">
            <Bar className="h-3 w-24" />
            <Bar className="h-3 w-20" />
          </div>
        </aside>
      </div>

      {/* Footer: Previous | flag and counter | Next. */}
      <footer className="flex h-16 shrink-0 items-center justify-between gap-2 border-t-2 border-rb-swan bg-rb-snow px-3 sm:px-4">
        <Bar className="h-10 w-28 rounded-[var(--radius-rb-pill)]" />
        <div className="flex items-center gap-4">
          <Bar className="h-4 w-28" />
          <Bar className="h-4 w-12" />
        </div>
        <Bar className="h-10 w-24 rounded-[var(--radius-rb-pill)]" />
      </footer>

      <span className="sr-only">Preparing your attempt…</span>
    </div>
  )
}
