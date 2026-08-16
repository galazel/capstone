import { TrendingUpIcon } from "@/components/icons"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

const PASS_THRESHOLD = 70

// Per-lesson performance with a strengths summary.
export default function PerformanceBreakdown({ lessonBreakdown }) {
  const list = Array.isArray(lessonBreakdown) ? lessonBreakdown : []
  if (list.length === 0) return null

  const sorted = [...list].sort(
    (a, b) => Number(a.percentage ?? 0) - Number(b.percentage ?? 0)
  )
  // Only lessons that were fully scored count toward strengths.
  const strengths = sorted.filter(
    (lesson) =>
      (lesson.pendingCount ?? 0) === 0 &&
      Number(lesson.percentage ?? 0) >= PASS_THRESHOLD
  )

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Performance by lesson</h2>

      <Card>
        <CardContent className="space-y-3 pt-5">
          {sorted.map((lesson) => {
            const pct = Number(lesson.percentage ?? 0)
            const pending = (lesson.pendingCount ?? 0) > 0
            return (
              <div key={lesson.lessonId} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium">
                    {lesson.lessonTitle}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {Number(lesson.earnedPoints)}/{Number(lesson.possiblePoints)} ·{" "}
                    {pct.toFixed(0)}%{pending ? " · pending" : ""}
                  </span>
                </div>
                <Progress value={pct} aria-label={`${lesson.lessonTitle} score`} />
              </div>
            )
          })}
        </CardContent>
      </Card>

      {strengths.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <TrendingUpIcon className="size-4 text-primary" aria-hidden="true" />
              Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {strengths.map((lesson) => (
                <li
                  key={lesson.lessonId}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate">{lesson.lessonTitle}</span>
                  <Badge variant="secondary">
                    {Number(lesson.percentage).toFixed(0)}%
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}
