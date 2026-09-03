import { Button } from "@/components/ui/button"
import ItemNavigatorCard from "./item-navigator-card.jsx"
import ItemStatusLegend from "./item-status-legend.jsx"

export default function QuestionNavigator({
                                            items,
                                            currentIndex,
                                            onJump,
                                            onFinish,
                                            finishDisabled = false,
                                          }) {
  const list = Array.isArray(items) ? items : []

  const totalPoints = list.reduce(
      (sum, item) =>
          sum + (item.points != null ? Number(item.points) : 0),
      0
  )

  return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-rb-wolf">
            Item Navigation
          </h3>

          <span className="shrink-0 rounded-[var(--radius-rb-pill)] bg-rb-polar px-2.5 py-1 text-xs font-bold tabular-nums text-rb-wolf">
          {totalPoints} pts
        </span>
        </div>

        {/* Scrollable, but scrollbar is hidden */}
        <div
            className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pt-1.5 pb-3
          [scrollbar-width:none]
          [-ms-overflow-style:none]
          [&::-webkit-scrollbar]:hidden
        "
        >
          {/* Always five across. This was auto-fill, which fitted whatever the
              column allowed -- and so the same exam showed five columns on a
              programming item and four on a short-answer one. The grid reflowed
              as the learner stepped through, moving every item to a new
              position. A navigator whose positions shift is worse than a
              slightly tighter one.

              Five only fitted the wider layouts, which is why auto-fill was
              here; the written-type aside is now w-72 rather than w-64, which
              is the width five cards need without clipping their points and
              flag badges. */}
          <div className="grid w-full auto-rows-max grid-cols-5 gap-2">
            {list.map((item, index) => (
                <ItemNavigatorCard
                    key={item.attemptQuestionId ?? index}
                    item={item}
                    index={index}
                    isCurrent={index === currentIndex}
                    onJump={onJump}
                />
            ))}
          </div>
        </div>

        <div className="mt-3 shrink-0 rounded-[var(--radius-rb-card)] border-2 border-rb-swan bg-rb-polar p-3">
          <ItemStatusLegend />
        </div>


      </div>
  )
}