import { TrendingUp, TrendingDown } from "@/components/icons"
import { MasteryIndicator } from './mastery-indicator'

/**
 * Mastery Change Display - shows how mastery changed after an assessment
 * Displays before/after mastery levels with visual progression
 */
export function MasteryChangeDisplay({
  masteryBefore,
  masteryAfter,
  levelBefore,
  levelAfter,
  lessonTitle,
  className = '',
}) {
  if (!masteryBefore || masteryAfter === undefined) {
    return null
  }

  const beforePercent = Math.round(masteryBefore * 100)
  const afterPercent = Math.round(masteryAfter * 100)
  const change = afterPercent - beforePercent
  const improved = change >= 0

  return (
    <div className={`rounded-lg border border-border bg-card p-6 ${className}`}>
      <div className="mb-4">
        <p className="text-sm font-medium text-muted-foreground">
          Mastery Update
        </p>
        {lessonTitle && (
          <p className="text-lg font-semibold text-foreground mt-1">
            {lessonTitle}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-6">
        {/* Before */}
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs font-medium text-muted-foreground">Before</p>
          <MasteryIndicator level={levelBefore} showLabel={false} size="lg" />
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{beforePercent}%</p>
            <p className="text-xs text-muted-foreground capitalize">
              {getMasteryLevelName(levelBefore)}
            </p>
          </div>
        </div>

        {/* Arrow & Change */}
        <div className="flex flex-col items-center gap-2">
          {improved ? (
            <TrendingUp className="w-6 h-6 text-green-600" />
          ) : (
            <TrendingDown className="w-6 h-6 text-red-600" />
          )}
          <span
            className={`text-lg font-bold ${
              improved
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {improved ? '+' : ''}{change}%
          </span>
        </div>

        {/* After */}
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs font-medium text-muted-foreground">After</p>
          <MasteryIndicator level={levelAfter} showLabel={false} size="lg" />
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{afterPercent}%</p>
            <p className="text-xs text-muted-foreground capitalize">
              {getMasteryLevelName(levelAfter)}
            </p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-6">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              improved
                ? 'bg-gradient-to-r from-blue-400 to-green-500'
                : 'bg-gradient-to-r from-blue-400 to-orange-500'
            }`}
            style={{ width: `${Math.min(afterPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Level change badge */}
      {levelBefore !== levelAfter && (
        <div className="mt-4">
          <p className="text-sm font-medium text-foreground mb-2">
            🎉 Achievement Unlocked!
          </p>
          <p className="text-sm text-muted-foreground">
            You've progressed from{' '}
            <span className="font-semibold text-foreground">
              {getMasteryLevelName(levelBefore)}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-foreground">
              {getMasteryLevelName(levelAfter)}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

function getMasteryLevelName(level) {
  const levels = [
    'Not Started',
    'Familiarity',
    'Beginning',
    'Intermediate',
    'Mastery',
  ]
  return levels[Math.min(level || 0, 4)]
}

/**
 * Compact version for result summaries
 */
export function MasteryChangeCompact({
  masteryBefore,
  masteryAfter,
  className = '',
}) {
  if (!masteryBefore || masteryAfter === undefined) {
    return null
  }

  const beforePercent = Math.round(masteryBefore * 100)
  const afterPercent = Math.round(masteryAfter * 100)
  const change = afterPercent - beforePercent
  const improved = change >= 0

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-full ${
        improved
          ? 'bg-green-100 dark:bg-green-950'
          : 'bg-orange-100 dark:bg-orange-950'
      } ${className}`}
    >
      {improved ? (
        <>
          <TrendingUp className="w-4 h-4 text-green-600" />
          <span className="text-sm font-semibold text-green-700 dark:text-green-300">
            {beforePercent}% → {afterPercent}%
          </span>
        </>
      ) : (
        <>
          <TrendingDown className="w-4 h-4 text-orange-600" />
          <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">
            {beforePercent}% → {afterPercent}%
          </span>
        </>
      )}
    </div>
  )
}
