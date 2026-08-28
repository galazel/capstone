/**
 * Loading shapes for the two full-bleed learning screens.
 *
 * The learner layout shows one skeleton while its portal query is in flight,
 * and it was the dashboard's: four stat tiles, a wide block, two panels. On
 * the dashboard that is the truth. On the topic and curriculum routes -- which
 * take `!max-w-none !gap-0 !p-0` so the page can run wall to wall -- it
 * rendered as unpadded grey slabs bleeding off every edge of the window, which
 * reads as a broken page rather than a loading one.
 *
 * So the shapes live here, where the layout can pick the one that matches the
 * route it is about to show, and the topic page can use the same one for its
 * own `isLoading` state instead of keeping a second copy in step by hand.
 *
 * Every shape holds the real geometry of the page it stands in for. That is
 * the whole job: the content should fill the frame in, not replace it, so
 * arriving is not a jump.
 */

const BLOCK = "animate-pulse rounded-rb-tile bg-rb-swan"

/**
 * A run of prose: a heading and the lines under it, a few times over.
 *
 * Exported because the topic page shows this on its own while one section's
 * body is fetched, with the rest of the page already painted.
 */
export function SectionStackSkeleton({ count = 3 }) {
  return (
    <div className="space-y-10">
      {Array.from({ length: count }, (_, section) => (
        <div key={section} className="space-y-3">
          <div className={`${BLOCK} h-6 w-1/2 max-w-sm`} />
          <div className={`${BLOCK} h-4 w-full`} />
          <div className={`${BLOCK} h-4 w-full`} />
          <div className={`${BLOCK} h-4 w-4/5`} />
        </div>
      ))}
    </div>
  )
}

/**
 * The topic page: outline rail, lesson header, section stack.
 *
 * Deliberately the two-column shape, never the three-column one: the tutor
 * panel is only offered on a lesson and only once the learner has opened it,
 * so a third column here would collapse the moment the real page rendered.
 */
export function TopicPageSkeleton() {
  return (
    <div
      className="rebyu-ds min-h-dvh w-full bg-rb-polar"
      role="status"
      aria-label="Loading topic"
    >
      <div className="grid min-h-dvh xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* The outline rail. Rows fade down the list -- the eye is told where
            the content starts, not that eight identical things are pending. */}
        <aside className="hidden min-h-0 border-r-2 border-rb-swan bg-rb-snow xl:block">
          <div className="sticky top-0 h-dvh space-y-6 p-5">
            <div className="space-y-2">
              <div className={`${BLOCK} h-3 w-24`} />
              <div className={`${BLOCK} h-5 w-40`} />
              <div className={`${BLOCK} h-2 w-full`} />
            </div>

            <div className="space-y-2">
              {Array.from({ length: 8 }, (_, row) => (
                <div
                  key={row}
                  className={`${BLOCK} h-9 w-full`}
                  style={{ opacity: 1 - row * 0.1 }}
                />
              ))}
            </div>
          </div>
        </aside>

        <main className="min-w-0 bg-rb-snow">
          {/* The lesson header: eyebrow, title, chip row -- the same three
              lines, at the same sizes, that are about to land here. */}
          <div className="border-b-2 border-rb-swan px-5 py-6 sm:px-8">
            <div className="mx-auto w-full max-w-6xl space-y-3">
              <div className={`${BLOCK} h-3 w-28`} />
              <div className={`${BLOCK} h-7 w-2/3 max-w-md`} />

              <div className="flex flex-wrap gap-2">
                {[88, 132, 116, 96].map((width) => (
                  <div key={width} className={`${BLOCK} h-7`} style={{ width }} />
                ))}
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
            <SectionStackSkeleton />
          </div>
        </main>
      </div>
    </div>
  )
}

/** Where each stop sits, as a fraction of the road's width. */
const STOP_OFFSETS = [0.5, 0.68, 0.5, 0.32, 0.5]

/**
 * The curriculum page: the progress strip, a unit banner, and the road.
 *
 * The stops zigzag the way the real path does rather than stacking in a
 * column -- a straight line of five identical blocks would resolve into a
 * winding road, and a layout that rearranges itself on arrival is the jump
 * this exists to avoid.
 */
export function CurriculumPageSkeleton() {
  return (
    <div
      className="rebyu-ds w-full bg-rb-polar"
      role="status"
      aria-label="Loading curriculum"
    >
      {/* The strip that carries the back control and the progress bar. */}
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-5 pb-1 pt-4 lg:px-8">
        <div className={`${BLOCK} size-12 rounded-rb-card`} />
        <div className="ml-auto flex items-center gap-3">
          <div className={`${BLOCK} h-2.5 w-24 rounded-rb-pill sm:w-32`} />
          <div className={`${BLOCK} h-4 w-10`} />
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-5 py-10 lg:px-8">
        <div className="mx-auto max-w-[820px] space-y-6">
          {/* The unit banner: the one wide, saturated bar the page opens with.
              Taller than a card on purpose -- it is the tallest thing above the
              fold, and a short block here would let the road jump upward when
              the real banner lands. */}
          <div className={`${BLOCK} h-[7.5rem] rounded-rb-card`} />

          {/* The road. A plinth and its label, five stops down the page. */}
          <div className="relative mx-auto mt-6" style={{ width: 440, height: 158 * 5 }}>
            {STOP_OFFSETS.map((offset, index) => {
              const labelOnLeft = index % 2 === 1
              return (
                <div
                  key={index}
                  className="absolute flex items-center gap-4"
                  style={{
                    top: 158 * index + 24,
                    left: `${offset * 100}%`,
                    transform: "translateX(-50%)",
                    flexDirection: labelOnLeft ? "row-reverse" : "row",
                  }}
                >
                  {/* The plinth: a wide, squat block, the footprint an
                      isometric box leaves. */}
                  <div className={`${BLOCK} h-[4.5rem] w-[9rem] rounded-rb-card`} />

                  {/* Its name, off to the side the way the real labels hang. */}
                  <div className="space-y-2">
                    <div className={`${BLOCK} h-4 w-28`} />
                    <div className={`${BLOCK} h-3 w-16`} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
